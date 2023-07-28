// Set the delay value between requests high enough to avoid
// the BGG API rate limits. Value in milliseconds.
// A value of 2500 is slow but reliable.
const apiDelay = 1750;

// Names for the database in IndexedDB, and the datastore within.
const dbName = 'floodgate';
const dsName = 'games';

// This pulls the game ID from the page you're currently browsing. It only
// looks for numbers in between two slashes. I could make it fancier.
const reId = /\/(\d+)\//;
const bggid = parseInt(reId.exec(window.location)[1], 10);

// Pull the game name from the title of the game page.
const reTitle = /(.*) \| Board Game \|/;
const title = reTitle.exec(document.title)[1];

// This is the object we're going to build and ultimately save.
const objGame = {
    "bggid": bggid,
    "name": title,
    "page": 1,
    "time": {
      "start": getDate()
    },
    "playerCounts": []
};

// Small function here to encapsulate the creation of a date.
// May update it in the future to make it BGG XML API friendly, e.g. 2023-07-16
function getDate() {
  let date = new Date(Date.now());
  return date;
}


// Open a connection to IndexedDB
let db;

async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    // If the object store doesn't exist in this browser then create one
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const objectStore = db.createObjectStore(dsName, { keyPath: "bggid" });
      objectStore.createIndex("name", "name", {unique: false});
    };

    request.onsuccess = function(event) {
      db = event.target.result;
      console.log('IndexedDB connection opened successfully!');
      resolve();
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Asynchronous function to read record from IndexedDB
async function readFromIndexedDB(key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([dsName], 'readonly');
    const store = transaction.objectStore(dsName);
    const getRequest = store.get(key);
      
    getRequest.onsuccess = function(event) {
      const record = event.target.result;

      // If there is a record of the game already in IndexedDB and it
      // doesn't have a finish time (for example, if we got a 429 error for
      // exceededing the BGG API rate limits) then we pick up where we left off.
      if (record && !record.time.finish) {
        objGame.page = record.page;
        objGame.playerCounts = record.playerCounts;
        objGame.time.start = record.time.start;
      }
      resolve(record);
    };
      
    getRequest.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Asynchronous function to retrieve data from BGG.
async function fetchData(delayDuration) {
  try {
    const delay = duration => new Promise(resolve => setTimeout(resolve, duration));
    await delay(delayDuration);
    
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/plays?id=${bggid}&page=${objGame.page}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/xml'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const xmlData = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, 'application/xml');
    
    return xmlDoc;
  } catch (error) {
    throw new Error(`Error: ${error.message}`);
  }
}

// Asynchronous function to write data to IndexedDB
async function writeToIndexedDB(db, ds, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ds, 'readwrite');
    const objectStore = transaction.objectStore(ds);

    const request = objectStore.put(data);
    
    request.onsuccess = function(event) {
      resolve();
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Asynchronous function to loop through all of the plays
// on BGG one page at a time
async function loopThroughPlays() {
  
  // Initialize our counter to a positive number so that the process makes at least
  // one call to the BGG XMLAPI 2.
  let numPlays = 1;
  
  while (numPlays > 0) {
    await fetchData(apiDelay)
      .then(xmlDoc => {
        // Process the XML document (XMLDOMObject).
        // Retrieve the total number of plays.
        numPlays = parseInt(xmlDoc.firstElementChild.attributes['total'].value, 10);

        // loop through all of the plays.
        Array.from(xmlDoc.firstElementChild.children).forEach( play => {
          let qty = parseInt(play.attributes['quantity'].value, 10);
          let numPlayers = 0;
          
          Array.from(play.children).forEach( element => {
            if (element.tagName == "players") numPlayers = element.children.length;
          });

          let playerCount = objGame.playerCounts[numPlayers];
            
          // The first time a specific player count is tallied, its cell within the array
          // is empty. I cannot increment a NaN value.
          objGame.playerCounts[numPlayers] = isNaN(playerCount) ? qty : playerCount + qty;
        });
  
        // Reduce the number of plays remaining to be checked.
        // THIS LINE IS REQUIRED FOR OUR LOOP!
        numPlays -= 100 * objGame.page++;
  
        // And give a little progress update to the user.
        console.log(numPlays > 0 ? `${numPlays} records remaining` : 'Finished!');

        // if we're done then add a finish time.
        if (numPlays < 1) {
          objGame.page--;
          objGame.time.finish = getDate();
        }
      })
      .catch(error => {
        // Handle any errors that occur during the fetch request
        console.error(error);
        numPlays = -1;
      })
      .finally(obj => {

        // Loop though our playerCounts array and fill in any indices
        // that were skipped and thus are empty. Cannot use map
        // or forEach because those don't stop on missing elements!
        for (i=0; i<objGame.playerCounts.length; i++) {
          let c = objGame.playerCounts[i];
          if (isNaN(c)) objGame.playerCounts[i] = 0;
        }
        writeToIndexedDB(db, dsName, objGame);
      });
  };
  
  // Close the connection to IndexedDB
  db.close();
  console.log('IndexedDB connection closed.');
}

// Open connection
await openIndexedDB();

// Read stuff
await readFromIndexedDB(bggid);

// Call the function to start the loop
loopThroughPlays();