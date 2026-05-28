// Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const loadingDiv = document.getElementById('loading');
const emptyStateDiv = document.getElementById('empty-state');

// TLDs to check
const TLDs = ['.com', '.net', '.io', '.co', '.ai', '.dev', '.app', '.tech', '.xyz', '.online', '.store'];

// Event listeners
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    // Get input value: trim, lowercase, letters, numbers, and hyphens only
    const word = searchInput.value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

    // If empty, do nothing
    if (!word) return;

    // Show loading, clear results
    loadingDiv.removeAttribute('hidden');
    emptyStateDiv.setAttribute('hidden', '');
    resultsContainer.innerHTML = '';

    try {
        // Check all TLDs in parallel
        const results = await checkAllTLDs(word);

        // Hide loading and render results
        loadingDiv.setAttribute('hidden', '');
        renderResults(results);
    } catch (error) {
        console.error('Search error:', error);
        loadingDiv.setAttribute('hidden', '');
        emptyStateDiv.removeAttribute('hidden');
    }
}

async function checkAllTLDs(word) {
    // Create promises for all TLD checks
    const promises = TLDs.map(tld => checkTLD(word, tld));

    // Wait for all checks to complete
    const results = await Promise.all(promises);

    return results.filter(result => result !== null);
}

async function checkTLD(word, tld) {
    try {
        const domain = word + tld;
        const res = await fetch("https://rdap.org/domain/" + domain);

        if (res.status === 404) {
            // 404 = available
            return { domain, tld, available: true };
        } else if (res.status === 200) {
            // 200 = taken
            return { domain, tld, available: false };
        } else {
            // Anything else = skip
            return null;
        }
    } catch (error) {
        // Skip on network errors
        return null;
    }
}

function renderResults(results) {
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
        emptyStateDiv.removeAttribute('hidden');
        return;
    }

    emptyStateDiv.setAttribute('hidden', '');
    results.forEach(result => {
        appendDomainCard(result);
    });
}

function appendDomainCard(result) {
    // Create card elements
    const card = document.createElement('div');
    card.className = 'domain-card';

    // Add accent color based on availability
    if (result.available) {
        card.classList.add('available'); // green accent
    } else {
        card.classList.add('taken'); // red accent
    }

    const domainNameSpan = document.createElement('span');
    domainNameSpan.className = 'domain-name';
    domainNameSpan.textContent = result.domain;

    const statusSpan = document.createElement('span');
    statusSpan.className = 'domain-status';
    statusSpan.textContent = result.available ? 'Available' : 'Taken';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyToClipboard(result.domain, copyBtn));

    card.appendChild(domainNameSpan);
    card.appendChild(statusSpan);
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
