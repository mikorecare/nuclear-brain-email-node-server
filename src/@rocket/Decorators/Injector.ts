import "reflect-metadata";
import { Type } from "..";

/**
 * The Injector stores services and resolves requested instances.
 */
export const Injector = new (class {
  /**
   * Resolves instances by injecting required services
   * @param {Type<any>} target
   * @returns {T}
   */
  resolve<T>(target: Type<any>): T {
    // tokens are required dependencies, while injections are resolved tokens from the Injector
    const tokens = Reflect.getMetadata("design:paramtypes", target) || [],
      injections = tokens.map((token: any) => Injector.resolve<any>(token));

    return new target(...injections);
  }
})();
