;(() => {
  const decodeText = (text) =>
    new TextDecoder('utf-8').decode(new TextEncoder().encode(text))

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
        ? decodeText(titleElement.innerText.trim())
        : 'No Data'
      let price = priceElement
        ? decodeText(priceElement.innerText.trim())
        : 'No Data'
      let discount = discountElement
        ? decodeText(discountElement.innerText.trim())
        : 'No Data'
      let rating = ratingElement
        ? decodeText(ratingElement.innerText.trim())
        : 'No Data'
      let sold = soldElement
        ? decodeText(soldElement.innerText.trim())
        : 'No Data'
      let image = imageElement ? imageElement.src : 'No Data'
      let link = linkElement
        ? 'https://shopee.co.th' + linkElement.getAttribute('href')
        : 'No Data'

      products.push({ title, price, discount, rating, sold, image, link })
    })

  chrome.runtime.sendMessage({ products })
})()
