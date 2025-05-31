/**
 * Decorator for a controller of a route
 * @param prefix name of the controller that will be added on the route name
 */
export const Controller = (prefix: string = ""): ClassDecorator => {
  return (target: any): void => {
    Reflect.defineMetadata("prefix", prefix, target);

    // Since routes are set by our methods this should almost never be true (except the controller has no methods)
    if (!Reflect.hasMetadata("routes", target)) {
      Reflect.defineMetadata("routes", [], target);
    }
  };
};
