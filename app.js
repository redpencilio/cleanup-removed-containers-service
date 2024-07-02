// see https://github.com/mu-semtech/mu-javascript-template for more info
import { app, query, update, errorHandler, sparqlEscapeDateTime } from 'mu';
let state = { clearing: false };
import { CronJob } from 'cron';

function timeout(ms) {
  return new Promise( (res) =>
    setTimeout( res, ms )
  );
}

async function startClearing() {
  if( !state.clearing ) {
    state.clearing = true;

    try {
      const whereClause = `?uri
                             a docker:Container;
                             docker:state ?state.
                           ?state
                              docker:status "removed";
                              ext:updatedAt ?updatedAt.
                           FILTER( ?updatedAt < ${sparqlEscapeDateTime(new Date(Date.now() - 5 * 1000 * 60)) /* 5 minutes ago*/} )`;

      console.info("Checking for containers to be removed");
      console.info(`Found ${(await query(`PREFIX docker: <https://w3.org/ns/bde/docker#>
                                          PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
                                          SELECT (COUNT (DISTINCT ?uri) AS ?amount) {
                                            ${whereClause}
                                          }`)).results.bindings[0].amount.value} containers to remove`);
      while ((await query(`PREFIX docker: <https://w3.org/ns/bde/docker#>
                           PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
                           ASK {
                             ${whereClause}
                           }`)).boolean) {
        console.info("Removing up to 100 containers");
        await update(`PREFIX docker: <https://w3.org/ns/bde/docker#>
                      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
                      DELETE {
                        ?uri ?p ?o .
                      } WHERE {
                        {
                          SELECT ?uri WHERE {
                            ${whereClause}
                          } LIMIT 100
                        }
                        ?uri ?p ?o .
                      }`);
        console.info("done");
        await timeout(1000); // grace period for the triplestore
      }
    }
    catch(e) {
      console.error(`ERROR: An error occurred whilst clearing containers!`);
      console.trace(e);
    }
    finally {
      console.info("Done cleaning containers");
      state.clearing = false;
    }
  } else {
    console.info(`Clearing already ongoing`);
  }
}

app.post('/schedule', async (_req, res) => {
  console.info(`Will schedule clearing`);

  if( state.clearing ) {
    console.info(`Was already clearing`);
    res
      .status(200)
      .send({ message: "Already clearing" });
  } else {
    console.info(`Requesting new clearing scheduling`);
    startClearing(); // no await, just start
    res
      .status(200)
      .send({ message: "Starting clearing process" });
  }
});

app.use(errorHandler);


const AUTO_DELETE_CRON_PATTERN = process.env.AUTO_DELETE_CRON_PATTERN;
const AUTO_DELETE_CONTAINERS = process.env.AUTO_DELETE_CONTAINERS;

if( (AUTO_DELETE_CRON_PATTERN && AUTO_DELETE_CRON_PATTERN != "")
    || (AUTO_DELETE_CONTAINERS && AUTO_DELETE_CONTAINERS != "") ) {
  const cronPattern = AUTO_DELETE_CRON_PATTERN || '0 */1 * * *';

  console.info(`Starting with cron pattern ${cronPattern}`);

  new CronJob(cronPattern, function () {
    console.info(`Requesting deletion of removed container metadata`);
    fetch('http://localhost/schedule', { method: 'POST' });
  }, null, true);
}
