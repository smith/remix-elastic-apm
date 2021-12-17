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

### Install Elastic APM and remix-elastic-apm

`npm install @elastic/apm-rum elastic-apm-node https://github.com/smith/remix-elastic-apm --save`
