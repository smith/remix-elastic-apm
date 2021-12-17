import shimmer from "shimmer";
import { createRoutes } from "@remix-run/server-runtime/routes";
import { matchRoutes } from "react-router";

export function getElasticApmClientConfig(options, apm) {
  const { currentTransaction } = apm;

  return {
    ...options,
    ...(currentTransaction
      ? {
          pageLoadSpanId: currentTransaction.ensureParentId(),
          pageLoadTraceId: currentTransaction.traceId,
          pageLoadSampled: currentTransaction.sampled,
        }
      : {}),
  };
}

function getRequestType(method: string, searchParams: URLSearchParams) {
  const isGet = method === "GET";
  const hasData = !!searchParams.get("_data");
  if (isGet && hasData) {
    return "loader";
  } else if (!isGet && hasData) {
    return "action";
  } else {
    return undefined;
  }
}

export function patchHandler(remixServerRuntime, agent, { version, enabled }) {
  shimmer.wrap(remixServerRuntime, "createRequestHandler", (orig) => {
    return function wrappedCreateRequestHandler(build, platform, mode) {
      const handler = orig.apply(this, arguments);
      const routes = createRoutes(build.routes);

      return async function wrappedHandler(request) {
        const url = new URL(request.url);
        const matches = matchRoutes(routes, url.pathname);

        if (matches) {
          const match = matches[matches.length - 1];
          const routeName = match.route.id.replace(/^routes/, "");
          const requestType =
            getRequestType(request.method, url.searchParams) || request.method;
          const transactionName = `${requestType} ${
            routeName === "root" ? "/" : routeName
          }`;
          console.log({ transactionName });
          agent.currentTransaction.setDefaultName(transactionName);
        }

        let response;

        try {
          response = await handler.apply(this, arguments);
          console.log({ response });
        } catch (e) {
          console.log({ e });
          agent.captureError(e, { response });
          throw e;
        }

        agent.currentTransaction.setOutcome(
          response.status >= 400 ? "failure" : "success"
        );

        return response;
      };
    };
  });
  return remixServerRuntime;
}
