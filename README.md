# Remix Elastic APM

_DO NOT USE THIS. THIS PROJECT IS EXPERIMENTAL AND NOT READY FOR PRODUCTION USE_

<p style="text-align: center"><img height=130 src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fres.cloudinary.com%2Fpracticaldev%2Fimage%2Ffetch%2Fs--MYEAq3yO--%2Fc_limit%252Cf_auto%252Cfl_progressive%252Cq_auto%252Cw_880%2Fhttps%3A%2F%2Fi.imgur.com%2F47Kvvsb.jpg&f=1&nofb=1" /> 🤜🤛 <img src="https://static-www.elastic.co/v3/assets/bltefdd0b53724fa2ce/blt987f36e6cf17bc9a/5ea8c7fba7bdee51f48010f7/brand-elastic-vertical-220x130.svg" /></p>

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

### Elastic cluster configuration

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
  frameworkName: "remix",
});
```

At this point, if you run `npm run dev` to build the Remix bundle, and `npm start` to run Express, then go to http://localhost:3000, transactions will be sent to your Elastic cluster.

If you open Kibana from your deployment and go to Observability > APM, "my-remix-app-server" should show up in the list of services.

You'll see transactions in the service overview, but they all will show up looking like "GET /\*" for the transaction name. That's not very helpful, so let's fix it.

### Patch Remix with Elastic APM instrumentation

The [`addPatch` method](https://www.elastic.co/guide/en/apm/agent/nodejs/master/agent-api.html#apm-add-patch) on the APM agent allows us to wrap loaded modules to change their behavior.

After the `const apm...` code we've added, add:

```js
apm.addPatch(
  "@remix-run/server-runtime",
  require("remix-elastic-apm").patchHandler
);
```

Now in Kibana your transactions will have names like "GET /demos/params/$id", "action /demos/actions", and "loader /index". These should correspond with your routes, actions, and loaders.

### Add client agent configuration to the load context

(it would be nice if this were easier to do, but this gets the job done. I've opened [remix-run/remix#1029](https://github.com/remix-run/remix/issues/1029) requesting a better way to do this.)

In order to do [correlation with the RUM agent](https://www.elastic.co/guide/en/apm/agent/nodejs/master/distributed-tracing.html#tracing-rum-correlation)
we'll need to get some context about the current transaction on the server to send to the client setup.

This will make it so that on page load the agent on the client will be able to correlate its transactions with the server transactions.

Where we currently have `createRequestHandler({ build: require("./build") })`, add:

```js
createRequestHandler({
  getLoadContext: () => {
    return {
      elasticApmRumAgentConfig:
        require("remix-elastic-apm").getElasticApmClientConfig(
          {
            serviceName: "my-remix-app-client",
            serverUrl: process.env.ELASTIC_APM_SERVER_URL,
          },
          apm
        ),
    };
  },
  build: require("./build"),
});
```

(Note that in the default Express setup there are two calls to `createRequestHandler` so you'll need to update both.)

When `getLoadContext` is called it will return something like:

```js
{
  serviceName: 'my-remix-app-client',
  serverUrl: 'https://my-cloud-cluster.es.io',
  pageLoadSpanId: '7f61a915f84d2caa',
  pageLoadTraceId: 'bf51f30595b60e2b5c23f19007ac2c60',
  pageLoadSampled: true
}
```

Return the context from the root loader by adding the following to app/root.tsx:

```js
export const loader: LoaderFunction = async ({ context }) => {
  return { elasticApmRumAgentConfig: context.elasticApmRumAgentConfig };
};
```

### Configure the RUM JS agent

Add this to app/entry.client.tsx before the call to `hydrate`:

```js
import { init as initApm } from "@elastic/apm-rum";
initApm(__remixContext.routeData.root.elasticApmRumAgentConfig);
```

This will initialize the APM agent with the data from the loader context.

Now after loading the app you should see "my-remix-app-client" in your list of services in Kibana.

On the client we record "page-load", "route-change", and "http-request" transactions.

In addition to the transaction data in APM, you can use the [User Experience dashboard](https://www.elastic.co/guide/en/observability/current/user-experience.html) to see and filter useful data about client-side interactions in your Remix app.

### Gratuitous Screenshots

<img width="1715" alt="CleanShot 2021-12-17 at 11 23 27@2x" src="https://user-images.githubusercontent.com/9912/146583658-fbc55da9-d275-4a22-9b70-be05360805b8.png">
<img width="1706" alt="CleanShot 2021-12-17 at 11 24 20@2x" src="https://user-images.githubusercontent.com/9912/146583724-51293267-c1a3-4933-b118-352ce4cd5f0d.png">
<img width="1705" alt="CleanShot 2021-12-17 at 11 25 01@2x" src="https://user-images.githubusercontent.com/9912/146583804-0f88df61-819b-48ea-995e-7d26898b1a94.png">

