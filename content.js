;(() => {
  if (window.stopShopeeExtraction) return

  let allProducts = []
  let maxPages = 3
  let currentPage = 1

  /**
   * Helper to parse Thai "sold" text into a numeric value.
   * e.g. "ขายแล้ว 3.9พัน ชิ้น" => 3900
   */
  function parseSoldText(text) {
    // Regex: capture digits (including decimals), optional Thai multiplier, then "ชิ้น"
    const regex = /ขายแล้ว\s*([\d.]+)\s*(พัน|หมื่น|แสน|ล้าน)?\s*ชิ้น/
    const match = text.match(regex)
    if (!match) {
      // If not matched, return 0 or handle differently
      return 0
    }

    let number = parseFloat(match[1]) // e.g. "3.9" => 3.9
    const unit = match[2] || ''

    switch (unit) {
      case 'พัน':
        number *= 1000
        break
      case 'หมื่น':
        number *= 10000
        break
      case 'แสน':
        number *= 100000
        break
      case 'ล้าน':
        number *= 1000000
        break
      default:
        // No multiplier (e.g. "ขายแล้ว 500 ชิ้น")
        break
    }
    return Math.floor(number)
  }

  function sendProductsToPopup() {
    chrome.runtime.sendMessage({ products: allProducts })
  }

  /**
   * Wait for product items to appear or time out.
   */
  function waitForElements(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        if (document.querySelector(selector)) {
          obs.disconnect()
          resolve(true)
        }
      })

      observer.observe(document, { childList: true, subtree: true })

      setTimeout(() => {
        obs.disconnect()
        resolve(false)
      }, timeout)
    })
  }

  /**
   * Scroll down in increments until the Shopee navigation bar appears,
   * or until we exceed max attempts.
   */
  async function scrollUntilNavigationBar() {
    const navSelector = 'nav.shopee-page-controller'
    let attempts = 0
    let maxAttempts = 20
    let scrollDistance = 500
    let pauseBetweenScrolls = 500

    return new Promise((resolve, reject) => {
      const scrollInterval = setInterval(() => {
        if (window.stopShopeeExtraction) {
          clearInterval(scrollInterval)
          resolve(false)
          return
        }

        let navBar = document.querySelector(navSelector)
        if (navBar) {
          clearInterval(scrollInterval)
          setTimeout(() => {
            resolve(true)
          }, 2000) // extra wait for full load
          return
        }

        window.scrollBy(0, scrollDistance)
        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(scrollInterval)
          reject(
            new Error('Navigation bar not found after max scroll attempts.')
          )
        }
      }, pauseBetweenScrolls)
    })
  }

  /**
   * Extract product info from the current loaded items.
   * We also compute `soldNumber` from the "ขายแล้ว ... ชิ้น" text.
   */
  function extractProducts() {
    if (window.stopShopeeExtraction) return

    const items = document.querySelectorAll('.shopee-search-item-result__item')
    let products = []

    items.forEach((item) => {
      let titleElement = item.querySelector('.line-clamp-2')
      let priceElement = [...item.getElementsByTagName('span')].find(
        (el) =>
          el.classList.contains('font-medium') &&
          el.classList.contains('truncate')
      )
      let discountElement = item.querySelector(
        '.text-shopee-primary.font-medium.bg-shopee-pink'
      )

      // For rating, partial class "text-shopee-black87" & "text-xs"
      let ratingElement = item.querySelector(
        '[class*="text-shopee-black87"][class*="text-xs"]'
      )

      // For sold, partial class
      let soldElement = item.querySelector(
        '.truncate.text-shopee-black87.text-xs'
      )

      let imageElement = item.querySelector('img')
      let linkElement = item.querySelector('a')

      let title = titleElement ? titleElement.innerText.trim() : 'No Data'
      let price = priceElement ? priceElement.innerText.trim() : 'No Data'
      let discount = discountElement
        ? discountElement.innerText.trim()
        : 'No Data'
      let rating = ratingElement ? ratingElement.innerText.trim() : 'No Data'

      // If there's a sold string, parse it
      let soldText = soldElement ? soldElement.innerText.trim() : 'No Data'
      let soldNumber = soldText !== 'No Data' ? parseSoldText(soldText) : 0

      let image = imageElement ? imageElement.src : 'No Data'
      let link = linkElement
        ? 'https://shopee.co.th' + linkElement.getAttribute('href')
        : 'No Data'

      if (title !== 'No Data' && price !== 'No Data') {
        products.push({
          title,
          price,
          discount,
          rating,
          sold: soldText, // original text
          soldNumber: soldNumber, // numeric
          image,
          link,
        })
      }
    })

    allProducts.push(...products)
    console.log(
      `Extracted ${products.length} products from page ${currentPage}`
    )
  }

  async function goToNextPage() {
    if (window.stopShopeeExtraction) {
      sendProductsToPopup()
      return
    }
    if (currentPage >= maxPages) {
      console.log('Reached max pages. Stopping.')
      sendProductsToPopup()
      return
    }

    let nextPageButton = document.querySelector(
      '.shopee-page-controller .shopee-icon-button--right'
    )
    if (
      !nextPageButton ||
      nextPageButton.classList.contains('shopee-icon-button--disabled')
    ) {
      console.log('No more next pages (button disabled). Stopping...')
      sendProductsToPopup()
      return
    }

    console.log(`Navigating to page ${currentPage + 1}...`)
    nextPageButton.click()

    // Wait up to 10s for next page items to load
    let loadedNextPage = await waitForElements(
      '.shopee-search-item-result__item',
      10000
    )
    if (!loadedNextPage) {
      throw new Error('Next page did not load within 10s.')
    }

    currentPage++
    console.log(`Scrolling page ${currentPage} to nav bar...`)
    await scrollUntilNavigationBar()

    console.log(`Extracting page ${currentPage} data...`)
    extractProducts()

    // Small delay
    await new Promise((r) => setTimeout(r, 2000))
    goToNextPage()
  }

  // Main flow wrapped in try/catch
  ;(async () => {
    try {
      // Wait for first page
      let firstPageLoaded = await waitForElements(
        '.shopee-search-item-result__item',
        10000
      )
      if (!firstPageLoaded) {
        console.log('No product items on the first page. Exiting...')
        return
      }

      console.log('Scrolling page 1 until nav bar is visible...')
      await scrollUntilNavigationBar()

      console.log('Extracting data from page 1...')
      extractProducts()

      console.log('Proceeding to next pages...')
      await new Promise((r) => setTimeout(r, 2000))
      goToNextPage()
    } catch (error) {
      console.error('[ERROR] Stopping extraction:', error)
      window.stopShopeeExtraction = true
      sendProductsToPopup()
    }
  })()
})()
