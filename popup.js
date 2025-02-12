document.getElementById('fetchData').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0]
    if (activeTab.url.includes('shopee.co.th')) {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js'],
      })
      document.getElementById('stopExtraction').disabled = false
      document.getElementById('saveCsv').disabled = true
    } else {
      alert('Please open a Shopee page before extracting data.')
    }
  })
})

document.getElementById('stopExtraction').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        window.stopShopeeExtraction = true
      },
    })
    document.getElementById('stopExtraction').disabled = true
  })
})

let extractedProducts = []

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.products) {
    extractedProducts = message.products
    let container = document.getElementById('data')
    container.innerHTML = ''

    message.products.forEach((product) => {
      let div = document.createElement('div')
      div.classList.add('product')
      div.innerHTML = `
        <img src="${product.image}" alt="${product.title}">
        <div class="product-details">
          <strong>${product.title}</strong><br>
          Price: <span style="color: red;">${product.price}</span><br>
          Discount: ${product.discount}<br>
          Rating: ${product.rating}<br>
          Sold: ${product.sold} (Parsed: ${product.soldNumber})<br>
          <a href="${product.link}" target="_blank">View Product</a>
        </div>
      `
      container.appendChild(div)
    })

    document.getElementById('saveCsv').disabled = extractedProducts.length === 0
  }
})

document.getElementById('saveCsv').addEventListener('click', () => {
  if (extractedProducts.length === 0) return

  // Add the "SoldNumber" column to our CSV
  let csvContent =
    'Title,Price,Discount,Rating,Sold,SoldNumber,Image Link,Product Link\n'

  extractedProducts.forEach((product) => {
    let row = [
      `"${product.title}"`,
      `"${product.price}"`,
      `"${product.discount}"`,
      `"${product.rating}"`,
      `"${product.sold}"`, // original text
      `"${product.soldNumber}"`, // numeric
      `"${product.image}"`,
      `"${product.link}"`,
    ].join(',')
    csvContent += row + '\n'
  })

  let blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })
  let link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'shopee_products.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
})
