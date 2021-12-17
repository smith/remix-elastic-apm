"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchHandler = exports.getElasticApmClientConfig = void 0;
const shimmer_1 = __importDefault(require("shimmer"));
const routes_1 = require("@remix-run/server-runtime/routes");
const react_router_1 = require("react-router");
function getElasticApmClientConfig(options, apm) {
    const { currentTransaction } = apm;
    return Object.assign(Object.assign({}, options), (currentTransaction
        ? {
            pageLoadSpanId: currentTransaction.ensureParentId(),
            pageLoadTraceId: currentTransaction.traceId,
            pageLoadSampled: currentTransaction.sampled,
        }
        : {}));
}
exports.getElasticApmClientConfig = getElasticApmClientConfig;
function getRequestType(method, searchParams) {
    const isGet = method === "GET";
    const hasData = !!searchParams.get("_data");
    if (isGet && hasData) {
        return "loader";
    }
    else if (!isGet && hasData) {
        return "action";
    }
    else {
        return undefined;
    }
}
function patchHandler(remixServerRuntime, agent, { version, enabled }) {
    shimmer_1.default.wrap(remixServerRuntime, "createRequestHandler", (orig) => {
        return function wrappedCreateRequestHandler(build, platform, mode) {
            const handler = orig.apply(this, arguments);
            const routes = (0, routes_1.createRoutes)(build.routes);
            return function wrappedHandler(request) {
                return __awaiter(this, arguments, void 0, function* () {
                    const url = new URL(request.url);
                    const matches = (0, react_router_1.matchRoutes)(routes, url.pathname);
                    if (matches) {
                        const match = matches[matches.length - 1];
                        const routeName = match.route.id.replace(/^routes/, "");
                        const requestType = getRequestType(request.method, url.searchParams) || request.method;
                        const transactionName = `${requestType} ${routeName === "root" ? "/" : routeName}`;
                        console.log({ transactionName });
                        agent.currentTransaction.setDefaultName(transactionName);
                    }
                    let response;
                    try {
                        response = yield handler.apply(this, arguments);
                        console.log({ response });
                    }
                    catch (e) {
                        console.log({ e });
                        agent.captureError(e, { response });
                        throw e;
                    }
                    agent.currentTransaction.setOutcome(response.status >= 400 ? "failure" : "success");
                    return response;
                });
            };
        };
    });
    return remixServerRuntime;
}
exports.patchHandler = patchHandler;
