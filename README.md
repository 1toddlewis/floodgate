# floodgate
Data mining tool for BoardGameGeek.com. Returns the number of plays logged at
each player count for the game you are currently browsing.

Floodgate is meant to be loaded as a Snippet within the Developer Tools in
Chrome. Open the developer tools, select the "Sources" tab at the top, and in
the next set of sub tabs click on the double-right arrow icon to reveal
"Snippets." Once there, click on the plus sign to add a new snippet. Copy and
paste the contents of floodgate.js into this snippet, and then save.

Floodgate is meant to be run while you are browsing a game page on
Boardgamegeek.com. It checks the URL of the page and looks for the game ID. For
example, if you are browsing the page for Sagrada, the URL is:

https://boardgamegeek.com/boardgame/199561/sagrada

And the game ID is 199561. When you are ready, highlight the floodgate snippet
and hit CTRL+Enter on Windows, or Command+Enter on a Mac to run the script.
Floodgate will do the following:

- Open a connection to your browser's IndexedDB data store;
- Check to see if an incomplete record for this game already exists. This might
   happen if you issue too many requests in a short amount of time, and receive
   a 429 error after tripping the API call rate limits on BGG.
- If a previous, incomplete record exists then Floodgate will pick up where it
   left off and continue making requests. Otherwise it will start all over from
   the beginning.
- Floodgate will begin requesting pages of logged plays for the game using the
   BGG XMLAPI2.
- Each page returns a maximum of 100 records.
- Floodgate will iterate through the records, capturing the quantity logged in
   each play, and the number of players that were recorded.
- Floodgate keeps a running total for every player count encountered.
- If no players were recorded, then Floodgate will track that total for 0
   players.
- Cumulative player count totals are recorded in an array, with the index of the
   array correlating to the number of players.
- After each page, Floodgate writes/updates an object in the IndexedDB data
   store.
- The data store uses "bggid" as a primary key, and has a secondary non-unique
   key defined for "name".
- When the requests are finished, Floodgate writes once more to add a finish
   time, and closes the data connection to IndexedDB.

You can find the data for all of the games you've analyzed on the "Application"
tab within Chrome Developer Tools. In the left-hand panel, go to the "Storage"
section, and then expand the entry for "IndexedDB." There you should find a
database named "floodgate", with a data store named "games." There you will find
all of the JSON objects corresponding to the games you've polled. There is a
subitem called "name" which shows the same information organized by the
secondary key of "name."

If a game you just polled is not showing up, then hit the refresh button within
the Developer Tools. It should be close to and below the "Sources" tab at the
top.

You can delete any entry by right-clicking on it in Windows or CTRL+clicking on
a Mac, and then selecting "Delete."

If you want to export all of the floodgate data to a JSON file for backup
purposes or to use elsewhere, then I recommend you load the [IndexedDB Exporter](https://chrome.google.com/webstore/detail/indexeddb-exporter/kngligbmoipnmljnpphhocajldjplgcj/)
Chrome extension, which you can find here:

https://chrome.google.com/webstore/detail/indexeddb-exporter/kngligbmoipnmljnpphhocajldjplgcj/

## a discussion about time
The first iteration of Floodgate stored epoch timestamps in milliseconds, e.g.:

Sunday, July 16, 2023 at 10:00:00 AM Pacific Daylight Time is 1689526800000.

That works fine for programmers, but it isn't very friendly for users. I have
updated Floodgate to store Date objects instead, so when you are looking at the
data in the IndexedDB section under "Storage" in the "Application" tab of the
Chrome Developer Tools, you can easily read when the data was retrieved.

Chrome is overly friendly in this regard. It automatically displays the time in
your local time zone. For me, the example above is displayed as:

Sun Jul 16 2023 10:00:00 GMT-0700 (Pacific Daylight Time)

When you use the IndexedDB Exporter, that timestamp is exported as an
ISO-8601-formatted string:

2023-07-16T17:00:00.000Z

That value is expressed in UTC, as indicated by the "Z" at the end. That format
doesn't work in Google Sheets. According to this [Stack Overflow article](https://stackoverflow.com/questions/30492832/iso-8601-string-to-date-in-google-sheets-cell), you can
use the following formula to change the ISO-8601 format into a usable Date
object in Sheets:

=DATEVALUE(MID(A1,1,10)) + TIMEVALUE(MID(A1,12,8))

But it is worth noting that YOU WILL LOSE TIME ZONE INFORMATION. The "Z" is
ignored. That formula results in our timestamp being represented in a cell like
so:

7/16/2023 17:00:00

Which Google Sheets interprets as local time. Seven hours were added to that
value.

I doubt anyone will be using these times for mission critical work, but just in
case be aware that this peculiar behavior exists.
