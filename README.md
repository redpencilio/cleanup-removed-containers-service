# Cleanup Removed Containers Service

Cleans up containers which have been staged as removed by redpencil/docker-monitor-service.

## Tutorials

### Add the app-http-logger

Modern versions of app-http-logger will have this pre-installed.  If not, it can be added by adding the following to docker-compose.yml:

```yaml
  cleanup-removed-containers:
    image: redpencil/cleanup-removed-containers
    environment:
      AUTO_DELETE_CONTAINERS="true"
```

## How-to guides

### Set a different cron pattern

Set `AUTO_DELETE_CRON_PATTERN` to a cron pattern to specify when cleanup should run.  For example:

```yaml
  cleanup-removed-containers:
    # image: ...
    environment:
      AUTO_DELETE_CRON_PATTERN="*/10 * * * *"
```

### Trigger service externally

The service can be triggered externally through delta messages by sending a `POST` to `/schedule`.  The body is ignored.  Be sure both `AUTO_DELETE_CONTAINERS` and `AUTO_DELETE_CRON_PATTERN` are either unset or contain the empty string:

```yaml
  cleanup-removed-containers:
    # image: ...
    environment:
      AUTO_DELETE_CRON_PATTERN=""
      AUTO_DELETE_CONTAINERS=""
```

The delta-notifier can use a callback configuration such as:

```json
    callback: {
      url: 'http://cleanup-removed-containers/schedule,
      method: 'POST'
    },
```

The service itself copes with being called many times and will only execute one runloop at a time.

## Discussions

### Should this service store cleanup state in the triplestore?

The service can be triggered using a cron pattern or by sending requests to the service.  It would indeed be ideal to support an object on which the state is written.  We lack good standards for this today and have chosen to limit the implementation to the direct cron pattern in the service.  Improvements welcome.

## Reference

### `POST /schedule`

Send a `POST` request to `/schedule` to start the clearing process unless a clearing process is already running.

### Environment variables

* `AUTO_DELETE_CONTAINERS`: When set and not the empty string, automatically deletes containers.  Uses the standard cron pattern unless `AUTO_DELETE_CRON_PATTERN` is set too.
* `AUTO_DELETE_CRON_PATTERN`: String containing cron pattern by which container removal will be triggered.  A javascript-based cron process is started which behaves as if `/schedule` is called at these intervals.
