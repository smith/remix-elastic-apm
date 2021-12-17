# Remix Elastic APM

_DO NOT USE THIS. THIS PROJECT IS EXPERIMENTAL AND NOT READY FOR PRODUCTION USE_

This package provides helpers for using [Remix](https://remix.run) with
the [Elastic APM Node.js agent](https://www.elastic.co/guide/en/apm/agent/nodejs/master/intro.html)
and the [Elastic APM Real User Monitoring JavaScript agent](https://www.elastic.co/guide/en/apm/agent/rum-js/5.x/intro.html).

While the Elastic APM agents are completely suitable for use with Remix in both
Node.js and browser environments, if you use it with Remix out of the box the
transaction names won't match what you would expect. This package allows you to
patch Remix's server runtime to improve the experience of using Remix with Elastic APM.

This project was the result of some exploratory work on instrumenting Remix, and
hopefully can be used as a starting point for adding official support in the future.

It should work in all Node.js-based environments, but I've only used it with Express.

## Usage

You'll want to have an existing Remix project started with Express Server as the deployment target.

### Elastic APM configuration

You'll need an Elastic APM server URL and secret token. The easiest way to get this set up is by creating a deployment on [Elastic Cloud](https://www.elastic.co/cloud/).

Once you have a deployment, you can copy the endpoint and secret token from the APM & Fleet page.

You'll want to store these as environment variables. See [the Remix environment variables documentation](https://remix.run/docs/getting-started/v1/guides/envvars) on how to set this up.

You can also use [direnv](https://direnv.net/) locally to manage these variables.

```
ELASTIC_APM_SERVER_URL="https://my-apm-server-url.es.io"
ELASTIC_APM_SECRET_TOKEN=abcdefghijklmnopqr
```

### Install Elastic APM and remix-elastic-apm

`npm install @elastic/apm-rum elastic-apm-node https://github.com/smith/remix-elastic-apm --save`

### Configure the Node.js agent

(We're just following the [Node.js setup instructions](https://www.elastic.co/guide/en/apm/agent/nodejs/master/custom-stack.html) here.)

In your server/index.js add the following to the top of the file:

```js
const apm = require("elastic-apm-node").start({
  serviceName: "my-remix-app-server",
  secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
  serverUrl: process.env.ELASTIC_APM_SERVER_URL,
});
```

At this point, if you run `npm run dev` to build the Remix bundle, and `npm start` to run Express, then go to http://localhost:3000, transactions will be sent to your Elastic cluster.

If you open Kibana from your deployment and go to Observability > APM, "my-remix-app-server" should show up in the list of services.

You'll see transactions in the service overview, but they all will show up looking like "GET /\*" for the transaction name. That's not very helpful, so let's fix it.

### Patch Remix with Elastic APM instrumentation

The [`addPatch` method](https://www.elastic.co/guide/en/apm/agent/nodejs/master/agent-api.html#apm-add-patch) on the APM agent allows us to wrap loaded modules to change their behavior.

After the `const apm...` code we've added, add:

```js
apm.addPatch(require("remix-elastic-apm").patchHandler);
```
