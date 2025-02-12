;(() => {
  if (window.stopShopeeExtraction) {
    console.log('Extraction stopped by user.')
    return
  }

  const decodeText = (text) => {
    if (!text) return 'No Data'
    return new TextDecoder('utf-8').decode(
      new TextEncoder().encode(text.trim())
    )
  }

  let allProducts = []
  let maxPages = 10
  let currentPage = 1

  const waitForElements = async (selector, timeout = 8000) => {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        if (document.querySelector(selector)) {
          obs.disconnect()
          resolve(true)
        }
      })

      observer.observe(document, { childList: true, subtree: true })

      setTimeout(() => {
        observer.disconnect()
        resolve(false)
      }, timeout)
    })
  }

  const fastScrollToBottom = async () => {
    return new Promise((resolve) => {
      let totalHeight = document.body.scrollHeight
      let scrollStep = 500
      let currentScroll = 0
      let scrollInterval = setInterval(() => {
        if (window.stopShopeeExtraction) {
          clearInterval(scrollInterval)
          console.log('Scrolling stopped by user.')
          return
        }
        window.scrollBy(0, scrollStep)
        currentScroll += scrollStep
        if (currentScroll >= totalHeight - window.innerHeight) {
          clearInterval(scrollInterval)
          setTimeout(resolve, 1500)
        }
      }, 50)
    })
  }

  const extractProducts = () => {
    if (window.stopShopeeExtraction) {
      console.log('Extraction stopped by user.')
      return
    }

    let products = []
    document
      .querySelectorAll('.shopee-search-item-result__item')
      .forEach((item) => {
        let titleElement = item.querySelector('.line-clamp-2')
        let priceElement = [...item.getElementsByTagName('span')].find(
          (el) =>
            el.classList.contains('font-medium') &&
            el.classList.contains('truncate')
        )
        let discountElement = item.querySelector(
          '.text-shopee-primary.font-medium.bg-shopee-pink'
        )
        let ratingElement = item.querySelector('.text-shopee-black87.text-xs')
        let soldElement = item.querySelector(
          '.truncate.text-shopee-black87.text-xs'
        )
        let imageElement = item.querySelector('img')
        let linkElement = item.querySelector('a')

        let title = titleElement
          ? decodeText(titleElement.innerText)
          : 'No Data'
        let price = priceElement
          ? decodeText(priceElement.innerText)
          : 'No Data'
        let discount = discountElement
          ? decodeText(discountElement.innerText)
          : 'No Data'
        let rating = ratingElement
          ? decodeText(ratingElement.innerText)
          : 'No Data'
        let sold = soldElement ? parseSoldQuantity(soldElement.innerText) : 0
        let image = imageElement ? imageElement.src : 'No Data'
        let link = linkElement
          ? 'https://shopee.co.th' + linkElement.getAttribute('href')
          : 'No Data'

        if (title !== 'No Data' && price !== 'No Data') {
          products.push({ title, price, discount, rating, sold, image, link })
        }
      })

    allProducts.push(...products)
    console.log(
      `Extracted ${products.length} products from page ${currentPage}`
    )
  }

  const goToNextPage = async () => {
    if (window.stopShopeeExtraction) {
      console.log('Pagination stopped by user.')
      chrome.runtime.sendMessage({ products: allProducts })
      return
    }

    if (currentPage >= maxPages) {
      console.log('Reached max pages. Sending data...')
      chrome.runtime.sendMessage({ products: allProducts })
      return
    }

    let nextPageButton = document.querySelector(
      '.shopee-page-controller .shopee-icon-button--right'
    )
    if (
      !nextPageButton ||
      nextPageButton.classList.contains('shopee-icon-button--disabled')
    ) {
      console.log('Next page button not available. Stopping.')
      chrome.runtime.sendMessage({ products: allProducts })
      return
    }

    console.log(`Navigating to page ${currentPage + 1}...`)
    nextPageButton.click()

    await new Promise((resolve) => setTimeout(resolve, 3000))
    let loaded = await waitForElements('.shopee-search-item-result__item', 8000)

    if (loaded) {
      currentPage++
      console.log(`Scrolling down on page ${currentPage}...`)
      await fastScrollToBottom()
      console.log(`Extracting data from page ${currentPage}...`)
      extractProducts()
      goToNextPage()
    } else {
      console.log('Page content did not load.')
      chrome.runtime.sendMessage({ products: allProducts })
    }
  }

  waitForElements('.shopee-search-item-result__item', 8000).then(async () => {
    console.log('Extracting data from page 1...')
    await fastScrollToBottom()
    extractProducts()
    goToNextPage()
  })
})()
