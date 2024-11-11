var current_request_controllers = [];
var last_request_controller = null;
var last_request_time = null;
var last_request_returned_no_resuts = false;
var results_cache = {};
var no_results = false;
var last_request_results = null;

var search_input = document.querySelector('#q');
var search_submit = document.querySelector('#search_submit');
var results_list = document.querySelector('#results');

if (search_input && search_submit) {
    // every 200 ms, check no results
    setInterval(function () {
        if (last_request_time && new Date() - last_request_time > 200 && no_results) {
            var list = results_list;
            list.innerHTML = '';
            var li = document.createElement('li');
            li.innerHTML = '<p>No results found.</p>';
            list.appendChild(li);
            no_results = false;
        }
    }, 350);

    function add_to_cache(query, data) {
        results_cache[query] = {
            "data": data,
            // make expire in 10s
            "expires": new Date() + 10000
        }
    }

    // if <link rel="prefetch" href="next-page.html" as="document">
    // if no page change in one secondsince last request, submit
    // run every second
    function checkForPageChange() {
        if (last_request_controller && new Date() - last_request_controller > 1000 && current_request_controllers.length == 0 && document.querySelector('.p-name a')) {
            var prefetch = document.createElement('link');
            prefetch.rel = 'prefetch';
            // preload top result
            prefetch.href = document.querySelector('.p-name a').href;
            prefetch.as = 'document';
            document.head.appendChild(prefetch);
            last_request_controller = null;
        }
    }

    function toTitleCase(str) {
        return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
        );
    }

    // if no active controllers and last 
    function submit() {
        // abort any existing requests
        if (current_request_controllers.length > 0) {
            current_request_controllers.forEach(controller => controller.abort());
        }
        var query = search_input.value;
        var start = 0;

        // remove whitespace from start and end
        query = query.trim();

        if (urlParams.has('page')) {
            start = (urlParams.get('page') - 1) * 10;
        }

        // update page url to ?q={query}&page={page}, without reloading the page or adding to history
        var newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + '?q=' + query + '&page=' + (start / 10 + 1);
        window.history.pushState({ path: newUrl }, '', newUrl);

        currentController = new AbortController();
        const { signal } = currentController;

        current_request_controllers.push(currentController);

        last_request_controller = new Date();

        // if query == "", add message to do a search and return
        if (query == "") {
            var list = results_list;
            list.innerHTML = '';
            var li = document.createElement('li');
            li.innerHTML = '<p>Please enter a search query.</p>';
            list.appendChild(li);
            return;
        }

        function process_results (data) {
            last_request_time = new Date();
            
            // if last_request_results and no results this turn, skip
            if (last_request_results && data.total_results == 0) {
                no_results = true;
                return;
            }

            var list = results_list;
            list.innerHTML = '';
            
            var results_count = data.total_results;
            var query_time = data.query_time;
            var original_query = (' ' + query).slice(1);

            var li = document.createElement('li');

            li.innerHTML = `<p>Found ${results_count} result${results_count === 1 ? '' : 's'}. Viewing page ${start / 10 + 1} of ${Math.ceil(results_count / 10)}.</p>`;

            if (data.spelling_corrections) {
                // spelling correction is a dict of mistake to correction
                var spelling_correction = data.spelling_corrections;
                var spelling_correction_text = 'Showing results for <b>';
                // replace in original query
                var made_corrections = false;
                for (var mistake in spelling_correction) {
                    // skip if the correction is the same as the mistake
                    if (mistake == spelling_correction[mistake]) {
                        continue;
                    }
                    made_corrections = true;
                    query = query.replace(mistake, spelling_correction[mistake]);
                }
                if (made_corrections) {
                    spelling_correction_text += query + '</b>. ';
                    spelling_correction_text += 'Search instead for ';
                    spelling_correction_text += `"<a href='?q="${original_query}"' style='font-weight: 600'>${original_query}</a>."`;

                    li.innerHTML += spelling_correction_text;
                }
            }

            li.style.marginBottom = '1em';
            list.appendChild(li);

            last_request_results = data.documents;

            // if data.highlighted_snippet has keys
            if (Object.keys(data.highlighted_snippet).length > 0) {
                // add li at top of list with highlighted snippet
                var li = document.createElement('li');

                if (data.highlighted_snippet.abbreviation) {
                    // Object { abbr: "CP", full: "the Coffee Protocol" }
                    li.innerHTML += `<p>${data.highlighted_snippet.abbreviation.abbr} stands for ${data.highlighted_snippet.abbreviation.full}.<p>`;
                }

                if (data.highlighted_snippet.definition) {
                    li.innerHTML += `<p>${data.highlighted_snippet.definition}</p>`;
                }

                if (data.highlighted_snippet.calendar) {
                    li.innerHTML += data.highlighted_snippet.calendar;
                }

                // has_abbreviation	"mbobhft"
                if (data.highlighted_snippet.has_abbreviation) {
                    li.innerHTML += `<p>Abbreviation: ${data.highlighted_snippet.has_abbreviation}</p>`;
                }

                if (data.highlighted_snippet.links) {
                    li.innerHTML += '<p>Links to this domain:</p>';
                    var ul = document.createElement('ul');
                    for (var link in data.highlighted_snippet.links) {
                        var a = document.createElement('a');
                        a.href = link;
                        a.textContent = data.highlighted_snippet.links[link];
                        var lis = document.createElement('li');
                        lis.appendChild(a);
                        ul.appendChild(lis);
                    }
                    li.appendChild(ul);
                }

                // if .word_use, create table of word use
                // word use is {year: count}
                if (data.highlighted_snippet.word_use) {
                    // turn into a list of years
                    var years = [];

                    for (var year in data.highlighted_snippet.word_use) {
                        // push {"year": year, "count": count}
                        years.push({"year": year, "count": data.highlighted_snippet.word_use[year]});
                    }

                    // rervese
                    years.reverse();

                    li.innerHTML += '<p># of articles that mention <b>' + query + '</b>, by year:</p>';
                    var table = document.createElement('table');
                    var thead = document.createElement('thead');
                    var tr = document.createElement('tr');
                    var th1 = document.createElement('th');
                    th1.textContent = 'Year';
                    var th2 = document.createElement('th');
                    th2.textContent = 'Count';
                    tr.appendChild(th1);
                    tr.appendChild(th2);
                    thead.appendChild(tr);
                    table.appendChild(thead);
                    var tbody = document.createElement('tbody');
                    years.forEach(year => {
                        var tr = document.createElement('tr');
                        var td1 = document.createElement('td');
                        td1.textContent = year.year;
                        var td2 = document.createElement('td');
                        td2.textContent = year.count;
                        tr.appendChild(td1);
                        tr.appendChild(td2);
                        tbody.appendChild(tr);
                    });
                    table.appendChild(tbody);

                    li.appendChild(table);
                }


                li.innerHTML += `<p><small>Featured snippet</small></p>`;

                li.classList.add('h-entry', 'list_entry');

                list.appendChild(li);
            }

            if (data.documents.length === 0) {
                no_results = true;
                return;
            }

            no_results = false;

            // iterate but have an accumulator
            data.documents.forEach((article) => {
                var li = document.createElement('li');

                li.classList.add('h-entry', 'list_entry');

                var h3 = document.createElement('h3');
                h3.classList.add('p-name');
                var a = document.createElement('a');
                a.href = article.url;
                a.textContent = article.title;
                h3.appendChild(a);

                var p = document.createElement('p');
                var articleElement = document.createElement('article');
                articleElement.classList.add('p-summary', 'e-content');

                if (article.type && article.type	== "github") {
                    p.innerHTML = `A ${toTitleCase(article.language)} project on GitHub.`;
                    articleElement.innerHTML = "<p>" + article.description + "</p>";
                } else {
                    if (article.published) {
                        // turn category into hyperlink of form https://jamesg.blog/{category}
                        var category_link = `<a href="https://jamesg.blog/${article.category_slug}">${article.category}</a>`;
                        // get YYYY-MM-DD from published date
                        // then create https://jamesg.blog/yyyy/mm/
                        var year = article.published.split('-')[0];
                        var month = article.published.split('-')[1];

                        var date = new Date(article.published);
                        var options = { year: 'numeric', month: 'long', day: 'numeric' };
                        article.published = date.toLocaleDateString('en-US', options);

                        var date_link = `<a href="https://jamesg.blog/${year}/${month}/">${article.published}</a>`;

                        p.innerHTML = `Published on ${date_link} under the ${category_link} category.`;
                    }
                    // Assume article.description is a string containing the article description
                    let description = article.description.replace(/(\r\n|\n|\r|\t|<br\s*\/?>)/gm, " "); 
                    
                    // Split the description into sentences
                    let sentences = description.split(/(?<=[.!?])\s+/);
                    
                    // Get the first two sentences
                    let firstTwoSentences = sentences.slice(0, 2).join(' ');
                    
                    // Update the innerHTML of the articleElement
                    articleElement.innerHTML = firstTwoSentences;

                    // if linked_from, add h3 with linked from
                    if (article.linked_from && Object.keys(article.linked_from).length > 0) {
                        // linked from is list  of {url: title}
                        var h4 = document.createElement('h4');
                        // don't call variable li or ul
                        h4.textContent = 'Linked from:';
                        articleElement.appendChild(h4);
                        h4.style.margin = '0';
                        h4.style.padding = '0';
                        var link_list = document.createElement('ul');
                        // article.linked_from ist a list of objects
                        for (var item of article.linked_from) {
                            var link_li = document.createElement('li');
                            var link_a = document.createElement('a');
                            link_a.href = item.url;
                            link_a.textContent = item.title;
                            link_li.appendChild(link_a);
                            link_list.appendChild(link_li);
                        }
                        articleElement.appendChild(link_list);
                    }
                }

                li.appendChild(h3);
                li.appendChild(p);
                li.appendChild(articleElement);

                list.appendChild(li);
            });
            
            if (results_count > 10) {
                var li = document.createElement('li');
                var pages = Math.ceil(results_count / 10);
                var ellipsis = false;
                for (var i = 1; i <= pages; i++) {
                    // if i == 1 or i == len(pages), always show
                    // otherwise, only show next and previous 2 pages
                    if (i != 1 && i != pages) {
                        if (i < start / 10 - 2 || i > start / 10 + 2) {
                            ellipsis = true;
                            continue;
                        }
                    }
                    if (ellipsis) {
                        var span = document.createElement('span');
                        span.textContent = '...';
                        span.style.marginRight = '1em';
                        li.appendChild(span);
                        ellipsis = false;
                    }
                    var a = document.createElement('a');
                    a.href = `?q=${query}&page=${i}`;
                    // if ?page= is in the URL, set the search input value to the query
                    if (urlParams.has('page')) {
                        if (urlParams.get('page') == i) {
                            a.style.fontWeight = '600';
                        }
                    }
                    a.textContent = `Page ${i}`;
                    a.style.marginRight = '1em';
                    li.appendChild(a);
                }
                list.appendChild(li);
            }

            // if page > 1 and results count == 0, redirect to page 1
            if (results_count == 0 && start > 0) {
                window.location.href = `?q=${query}&page=1`;
            }
        }

        // check cache
        if (results_cache[query] && new Date() < results_cache[query].expires) {
            data = results_cache[query].data;
            process_results(data);
        } else {
            fetch('https://jamesg.blog/search-idx/?q=' + query + '&start=' + start, { method: 'POST', signal })
                .then(response => {
                if (response.ok) {
                    return response.json();
                }
                return Promise.reject(response);
                })
                .then(data => {
                    add_to_cache(query, data);
                    process_results(data);
                })
                .catch(error => {
                    // do nothing if DOMException: The operation was aborted. 
                    if (error.name == 'AbortError') {
                        return;
                    }
                    var list = results_list;
                    list.innerHTML = '';
                    var li = document.createElement('li');
                    li.innerHTML = `<p>There was an error searching for "${query}". If this error persists, please email <a href="mailto:readers@jamesg.blog">readers@jamesg.blog</a>.</p>`;
                    list.appendChild(li);
                });
        }
    }

    // if ?q= is in the URL, set the search input value to the query
    var urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('q')) {
        search_input.value = urlParams.get('q');
        submit();
    }
    // add listener
    search_submit.addEventListener('click', submit);

    // if enter is pressed, submit the form
    search_input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            submit();
        }
    });

    // if enter pressed on button
    search_submit.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            submit();
        }
    });

    // if prefers reduced motion or data is set, don't animate
    // if user on mobile, disable
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !window.matchMedia('(prefers-reduced-data: reduce)').matches && !window.matchMedia('(max-width: 600px)').matches) {
        search_input.addEventListener('input', function () {
            submit();
        });
    }

    setInterval(checkForPageChange, 1000);

    document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement !== search_input) {
            search_input.focus();
            // clear the input
            search_input.value = '';
            e.preventDefault();
        }
    });
}
