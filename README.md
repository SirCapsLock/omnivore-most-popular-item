# Omnivore: Most Popular Item
Crawl the Omnivore API to get the most popular item for a given location

## Prequisites
- Running postgres db
- Modify .env file with your own postgres db config and omnivore api config

## Run
```
mv .env.example .env
npm install
npm run dev
```

## Endpoints
`POST /locations/{locationId}/seed`

creates the necessary table and walks the omnivore /tickets api to populate the table

`GET /locations/{locationId}/items/popular`

Optional query params: `startDate`, `endDate`. If neither is provided, the most popular item from the last 30 days is returned.

Example: `GET /locations/{locationId}/items/popular?startDate=2021-08-26&endDate=2021-09-04`

## Considerations

### Getting the item_sales table populated
For this POC, I simply walk the /tickets API to populate the data. This may not be the best plan as thousands of tickets for thousands of locations would need to be walked to support this feature. Instead, I would consider using an SQS queue that is subscribed to an SNS topic like `TICKET_CLOSED`. An AWS Lambda function subscribed to the SQS queue could then be responsible for incrementing item quantities sold in the table. 


### Alternative storage for items sold

In this POC I use a postgres database with a table that holds item sales data for each item sold at a location per day. The reasoning here is that this provides the most flexible storage of this data. Since the table is indexed by its `location_id` and `date` columns, lookups against it to find the most popular items for a given day will be quick. Depending on the budget and other current infrastructure considerations, the following alternatives to a Postgres db are possible:

- DynamoDB table (or other NoSQL data store) whose primary key is `locationId` with sort key `date`. Each item in this table would have a listing of items sold on that day with data similar to that of a single record in the postgres `item_sales` table

- Firebase RTDB (BEWARE): Speaking of NoSQL, it would also be possible to contain this information in a firebase rtdb bucket like:
```
itemSales/
  /{locationId}
    /{date}/
      /{itemId}
        { item_id: 'xxx', item_name: 'xxx', quantity: 1 }
```
This approach is nice because you could potentially show item quantities being sold in real time, but one must consider the amount of connections that might happen against the db as well as the cost of the bandwidth.

### Future Improvements
- There's nothing right now that handles the case of a "tie" in most popular product. We would need to decide a tie-breaker if necessary.
- Create a materialized view that holds the most popular item for a location on a particular date. This would be updated as new sales data is recorded.
- Partition the `items_sold` table by date
- Add a redis caching layer with entries keyed by location and date so that the calculation only needs to be performed once
