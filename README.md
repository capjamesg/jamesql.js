> [!IMPORTANT]  
> This project is not ready to use yet.

# jamesql.js

A library to create the front-end for a search engine implemented with JameSQL.

## How to Use

First, copy the `search.js` file from this project repository.

Then, add the following code immediately before the closing `</body>` tag on the page on which you want to use this script:

```html
<script>const SEARCH_ENDPOINT = "http://localhost:5000";
<script src="search.js"></script>
```

Replace the `localhost:5000` URL with the URL of your JameSQL server.

Create three elements on the page:

1. A search `input` form with the ID `q`;
2. A `submit` button with the ID `search_submit`, and;
3. A `ul` or `ol` with the ID `results`.

## License

This project is licensed under an [MIT license](LICENSE).
