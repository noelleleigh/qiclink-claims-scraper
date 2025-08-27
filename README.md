**[Moved to Sourcehut](https://git.sr.ht/~noelle/qiclink-claims-scraper)**

# qiclink-claims-scraper

Command-line tool for bulk-downloading your insurance claims from a
[QicLink Benefits Exchange](http://www.trizetto.com/PayerSolutions/CoreAdministration/QicLink/ConstituentPortal/)
website.

I wanted to download my insurance claims from my employer, but I wasn't interested in clicking on
each redirection link and and manually downloading and naming each file individually, so I wrote a
script using the excellent [Puppeteer Node.js library](https://github.com/GoogleChrome/puppeteer/)
to script a headless web browser to do the work for me!

This has been tested on:

- Windows 10 x64
- Node.js v8.9.4 (latest LTE as of this writing)
- QicLink Benefits Exchange Version 5.00.44.02

If your version of QBE is different, you may need to dig into the code and
change some CSS selectors to make sure Puppeteer is manipulating the right elements.

# Install

```
git clone https://github.com/noahleigh/qiclink-claims-scraper.git
cd qiclink-claims-scraper
npm install
```

# Usage
1. Create a `.env` file in the repository folder using this template:
    ```
    loginPage=""
    userID=""
    password=""
    startDate=""
    endDate=""
    ```
2. Fill in the strings with values:
    - `loginPage`: The URL of the page where you enter your credentials
    - `userID`: Your user ID
    - `password`: Your password
    - `startDate`: The starting date of the period you want to retrieve claims from in `MM/DD/YYYY` format
    - `endDate`: The ending date of the period you want to retrieve claims from in `MM/DD/YYYY` format

    **IMPORTANT**: This file will contain *all* the information necessary to access your insurance
    dashboard. It goes without saying that you should keep this file safe and destroy it once it is
    no longer needed.

3. Run the script:
    ```
    npm start
    ```
    If all goes well, your claims should start appearing in the repository folder with the name
    format `{claim #}-{worksheet #}_{YYYY}-{MM}-{DD}.pdf` (e.g. `24419415-01_2015-10-27.pdf`).
