import { InjectableDecorator, Type } from "..";

/**
 * @returns {InjectableDecaorator<Type<any>>}
 * @constructor
 */
export const Injectable = (): InjectableDecorator<Type<any>> => {
  /*   return (target: Type<any>) => {
    // do something with `target`, e.g. some kind of validation or passing it to the Injector and store them
  }; */

  return function<T extends new (...args: any[]) => {}>(constructor: T): T {
    return class extends constructor {};
  };
};
