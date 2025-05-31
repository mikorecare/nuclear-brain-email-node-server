import { Callback, RequestMethod } from "..";

export interface IRoute {
  // Path to our route
  path: string;
  // HTTP Request method (get, post, ...)
  requestMethod: RequestMethod;
  // Method name within our class responsible for this route
  methodName: string;
  // Middleware for validition of route
  validations: Callback[];
}

export interface IMethod {
  path: string;
  validations?: Callback[];
}
