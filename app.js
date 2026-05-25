// Cache for wordlist
let wordlistCache = null;
let allResults = [];

// Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const loadingDiv = document.getElementById('loading');
const emptyStateDiv = document.getElementById('empty-state');
const tldButtons = document.querySelectorAll('.tld-btn');

// Event listeners
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

tldButtons.forEach(button => {
    button.addEventListener('click', () => {
        tldButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        renderResults();
    });
});

async function performSearch() {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) return;

    // Show loading, clear results
    loadingDiv.removeAttribute('hidden');
    emptyStateDiv.setAttribute('hidden', '');
    resultsContainer.innerHTML = '';
    allResults = [];

    try {
        // Fetch wordlist if not cached
        if (!wordlistCache) {
            wordlistCache = await fetchWordlist();
        }

        // Filter words based on query
        const words = filterWords(wordlistCache, query);

        // Check if input itself is in wordlist, if not add it as a domain to check
        if (!wordlistCache.includes(query)) {
            words.push(query);
        }

        // Always check all TLDs
        const allTLDs = ['.com', '.net', '.io', '.co', '.org', '.info', '.dev'];

        if (words.length === 0) {
            loadingDiv.setAttribute('hidden', '');
            emptyStateDiv.removeAttribute('hidden');
            return;
        }

        // Check domains in batches
        await checkDomainsInBatches(words, allTLDs);

        // Hide loading and render filtered results
        loadingDiv.setAttribute('hidden', '');
        renderResults();
    } catch (error) {
        console.error('Search error:', error);
        loadingDiv.setAttribute('hidden', '');
        emptyStateDiv.removeAttribute('hidden');
    }
}

async function fetchWordlist() {
    const url1 = 'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt';
    const url2 = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';

    try {
        // Fetch both sources in parallel
        const [response1, response2] = await Promise.all([
            fetch(url1),
            fetch(url2)
        ]);

        const [text1, text2] = await Promise.all([
            response1.text(),
            response2.text()
        ]);

        // Parse both wordlists
        const parseWords = (text) => {
            return text.split('\n')
                .map(word => word.trim().toLowerCase())
                .filter(word => /^[a-z]+$/.test(word) && word.length >= 3 && word.length <= 12);
        };

        const words1 = parseWords(text1);
        const words2 = parseWords(text2);

        // Merge and deduplicate using Set
        const uniqueWords = Array.from(new Set([...words1, ...words2]));

        return uniqueWords;
    } catch (error) {
        console.error('Error fetching wordlist:', error);
        return [];
    }
}

function filterWords(words, query) {
    let filtered;

    if (query.length <= 2) {
        // 1-2 chars: starts with
        filtered = words.filter(word => word.startsWith(query));
    } else {
        // 3+ chars: contains
        filtered = words.filter(word => word.includes(query));
    }

    return filtered.slice(0, 20);
}

async function checkDomainsInBatches(words, tlds) {
    // Create list of all domain combinations with metadata
    const allDomains = [];
    for (const word of words) {
        for (const tld of tlds) {
            allDomains.push({ word, tld, domain: word + tld });
        }
    }

    // Process in batches of 5
    for (let i = 0; i < allDomains.length; i += 5) {
        const batch = allDomains.slice(i, i + 5);
        const promises = batch.map(item => checkDomain(item.domain));

        const results = await Promise.all(promises);

        // Store available domains in allResults
        for (let j = 0; j < results.length; j++) {
            if (results[j]) {
                allResults.push({
                    word: batch[j].word,
                    tld: batch[j].tld,
                    full: batch[j].domain
                });
            }
        }

        // Delay between batches (not after the last batch)
        if (i + 5 < allDomains.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
}

async function checkDomain(domain) {
    try {
        const response = await fetch('https://rdap.org/domain/' + domain);

        if (response.status === 404) {
            // Domain is available
            return domain;
        }

        // Status 200 means taken, other statuses ignored
        return null;
    } catch (error) {
        // Network or other errors, skip
        return null;
    }
}

function renderResults() {
    resultsContainer.innerHTML = '';

    // Get active TLD
    const activeBtn = document.querySelector('.tld-btn.active');
    const activeTld = activeBtn.getAttribute('data-tld');

    // Filter results by active TLD
    const filteredResults = allResults.filter(result => result.tld === activeTld);

    if (filteredResults.length === 0) {
        emptyStateDiv.removeAttribute('hidden');
        return;
    }

    emptyStateDiv.setAttribute('hidden', '');
    filteredResults.forEach(result => {
        appendDomainCard(result.word, result.tld, result.full);
    });
}

function appendDomainCard(word, tld, fullDomain) {
    // Create card elements
    const card = document.createElement('div');
    card.className = 'domain-card';

    const domainNameSpan = document.createElement('span');
    domainNameSpan.className = 'domain-name';
    domainNameSpan.textContent = word;

    const domainTldSpan = document.createElement('span');
    domainTldSpan.className = 'domain-tld';
    domainTldSpan.textContent = tld;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyToClipboard(fullDomain, copyBtn));

    card.appendChild(domainNameSpan);
    card.appendChild(domainTldSpan);
    card.appendChild(copyBtn);

    resultsContainer.appendChild(card);
}

function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        button.classList.add('copied');
        setTimeout(() => {
            button.classList.remove('copied');
        }, 2000);
    }).catch(error => {
        console.error('Copy failed:', error);
    });
}
