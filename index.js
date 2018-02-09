require('dotenv').config()
const fs = require('fs')
const path = require('path')
const request = require('request')
const process = require('process')
const puppeteer = require('puppeteer')

/**
 * Send the `page` to the provided URL, fill in the username and password and submit them. Return
 * the `page` after navigation.
 * @param {puppeteer.Page} page
 * @param {string} url
 * @param {string} userID
 * @param {string} password
 * @returns {Promise<puppeteer.Page>} The same page
 */
const login = async (page, url, userID, password) => {
  await page.goto(url)
  await page.type('#ctl00_ContentPlaceHolder1_txtUserName', userID)
  await page.type('#ctl00_ContentPlaceHolder1_txtPassword', password)
  await Promise.all([
    page.waitForNavigation(),
    page.click('#ctl00_ContentPlaceHolder1_imgLogin')
  ])
  return page
}

/**
 * Navigate the `page` to the URL specified in the `claimsPage` environment variable.
 * @param {puppeteer.Page} page
 * @returns {Promise<puppeteer.Page>} The same page
 */
const goToClaimsPage = async (page) => {
  await page.goto(process.env.claimsPage)
  return page
}

/**
 * Fetch the list of claims from `startDate` to `endDate`.
 * @param {puppeteer.Page} page
 * @param {string} startDate - Date in `MM/DD/YYYY` format
 * @param {string} endDate - Date in `MM/DD/YYYY` format
 * @returns {Promise<puppeteer.ElementHandle>} Reference to the table displaying the list of claims
 */
const loadClaimsTable = async (page, startDate, endDate) => {
  const tableSelector = '#G_ctl00xContentPlaceHolder1xuwtClaimSearchxxctl0xMemberClaimsInfo1xUltraWebGrid2'
  const countMsgSelector = '#ctl00_ContentPlaceHolder1_uwtClaimSearch__ctl0_MemberClaimsInfo1_lblCountMsg'
  // Fill dates and click search
  await page.type('#ctl00_ContentPlaceHolder1_uwtClaimSearch__ctl0_wdcFromDate_input', startDate)
  await page.type('#ctl00_ContentPlaceHolder1_uwtClaimSearch__ctl0_wdcEndDate_input', endDate)
  await page.click('#ctl00_ContentPlaceHolder1_uwtClaimSearch__ctl0_btnSearchEnrollee')
  await page.waitForSelector(tableSelector)

  // Check how many found
  const numTotalRecords = await page.$(countMsgSelector)
    .then(element => element.getProperty('textContent'))
    .then(handle => handle.jsonValue())
    .then(string => /^(\d+) record\(s\)/.exec(string)[1])
    .then(Number.parseInt)
  const numVisibleRecords = await page.$(tableSelector)
    .then(table => table.$('tbody'))
    .then(tbody => tbody.getProperty('children'))
    .then(childrenArray => childrenArray.getProperty('length'))
    .then(handle => handle.jsonValue())

  // If they're not all displayed, check the "Display All Records" checkbox
  if (numVisibleRecords < numTotalRecords) {
    await page.click('#ctl00_ContentPlaceHolder1_uwtClaimSearch__ctl0_MemberClaimsInfo1_ckbAllRecords')
    await page.waitForFunction(`document.querySelector('${tableSelector} tbody').children.length === ${numTotalRecords}`)
  }

  return page.$(tableSelector)
}

/**
 * Return an array of objects `{filename, url}` from the contents of the `table`.
 *
 * `filename` property is the claim number joined with the service date (in ISO-8601 format),
 * e.g. `26381364-01_2017-11-31.pdf`
 *
 * `url` property is initial URL to the PDF (before redirects)
 * @param {puppeteer.ElementHandle} table
 * @returns {Promise<Object[]>} Array of objects containing a filename and a URL
 */
const getLinksFromTable = async (table) => {
  const rows = await table.$$('tbody > tr')
  const links = []

  for (let row of rows) {
    // Get the claim number
    const claimNum = await row.$('td:nth-child(2) > nobr')
      .then(element => element.getProperty('textContent'))
      .then(handle => handle.jsonValue())

    // Get the service date and convert it to ISO-8601 format
    const serviceDate = await row.$('td:nth-child(6) > nobr')
      .then(element => element.getProperty('textContent'))
      .then(handle => handle.jsonValue())
      .then(dateString => /(\d\d)\/(\d\d)\/(\d\d\d\d)/.exec(dateString))
      .then(regexResults => [regexResults[3], regexResults[1], regexResults[2]].join('-'))

    const filename = `${claimNum}_${serviceDate}.pdf`

    // Click the "Check EOB" link
    const url = await row.$('td:nth-child(9) > nobr > a')
      .then(link => link.getProperty('href'))
      .then(handle => handle.jsonValue())
      .then(jstring => /javascript:OpenWindow\('(.+)'\)/.exec(jstring)[1])
      .then(url => url.replace(/%25/g, '%'))

    links.push({
      filename,
      url
    })
  }
  return links
}

/**
 * Download the file at `url` to the current working dir as `filename`. Use `cookies` if necessary
 * to access resource
 * @param {string} url
 * @param {string} filename
 * @param {Object[]} cookies - Array of objects containing `name` and `value` properties
 * representing cookies that will be sent in the `Cookie` header of the HTTPS GET request.
 */
const downloadFile = async (url, filename, cookies) => {
  const options = {
    encoding: null,
    headers: {
      'Cookie': cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
    }
  }
  request(url, options, (err, res, body) => {
    if (err) {
      console.error(err)
      return
    }
    const filePath = path.resolve(__dirname, filename)
    fs.writeFile(filePath, body, {encoding: 'binary'}, err => {
      if (err) {
        console.error(err)
      } else {
        console.log(filePath)
      }
    })
  })
}

/**
 * Download claims based on information in environment variables.
 */
const main = async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await login(page, process.env.loginPage, process.env.userID, process.env.password)
  await goToClaimsPage(page)
  const tableHandle = await loadClaimsTable(page, process.env.startDate, process.env.endDate)
  const links = await getLinksFromTable(tableHandle, page, browser)
  // Strategy: https://github.com/GoogleChrome/puppeteer/issues/299#issuecomment-330623847
  const cookies = await page.cookies()
  for (let link of links) {
    await downloadFile(link.url, link.filename, cookies)
  }
  await browser.close()
}

module.exports = {
  login,
  goToClaimsPage,
  loadClaimsTable,
  getLinksFromTable,
  downloadFile,
  main
}

if (require.main === module) {
  main()
    .catch(error => {
      console.error(error)
    })
}
