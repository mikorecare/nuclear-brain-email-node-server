import { IValidationError } from "../interfaces";
import { DateHelper } from "../helpers";
import { Types } from "mongoose";

export class Check {
  private error: IValidationError = { hasError: false };
  private body: any;
  private fieldValue: any;
  constructor(obj: any, private fieldName: string) {
    this.body = obj;
    if (fieldName !== "PARAMETERS") {
      this.fieldName = fieldName;
      this.fieldValue = this.body[this.fieldName];
      this.check();
    }
  }

  getError(): any {
    return this.error;
  }

  checkError(): boolean {
    return this.error["hasError"];
  }

  check(): this {
    this.error = { hasError: false };
    if (!this.isStringSanitize(this.fieldValue)) {
      this.error = { hasError: true, message: `${this.fieldName} has invalid character input!` };
    }

    if (!this.checkError()) {
      this.error =
        undefined === this.fieldValue
          ? { hasError: true, message: `${this.fieldName} is required` }
          : { hasError: false, name: this.fieldName, value: this.fieldValue };
    }
    return this;
  }

  isStringSanitize(val: string): boolean {
    const validChars = /^[ A-Za-z0-9_@.=\/#&+"',*\n:;{}()!?-]*$/;
    if (typeof this.fieldValue === "string" && !validChars.test(this.fieldValue) && !(this.fieldValue.includes("[") && this.fieldValue.includes("]"))) {
      return new RegExp(`^[a-zA-Z0-9 _.-]*$`).test(val);
    }
    return true;
  }

  isEqualTo(data: any): this {
    if (!this.checkError()) {
      this.error =
        data !== this.fieldValue
          ? { hasError: true, message: `${this.fieldName} doesn't exist.` }
          : { hasError: false, name: this.fieldName, value: this.fieldValue };
    }
    return this;
  }

  isNotEqualTo(data: any): this {
    if (!this.checkError()) {
      this.error =
        data === this.fieldValue
          ? { hasError: true, message: `${this.fieldName} is already exist.` }
          : { hasError: false, name: this.fieldName, value: this.fieldValue };
    }
    return this;
  }

  checkExist(data: any): boolean {
    return data !== null && Object.keys(data).length > 0;
  }

  isExist(data: any): this {
    if (!this.checkError()) {
      this.error = this.checkExist(data)
        ? { hasError: true, message: `'${this.fieldName}' is already exist.` }
        : { hasError: false, name: this.fieldName, value: this.fieldValue };
    }
    return this;
  }

  isNotExist(data: any): this {
    if (!this.checkError()) {
      this.error = !this.checkExist(data)
        ? { hasError: true, message: `${this.fieldName} is not exist.` }
        : { hasError: false, name: this.fieldName, value: this.fieldValue };
    }
    return this;
  }

  notEmpty(): this {
    const isType = Array.isArray(this.fieldValue) ? "array" : typeof this.fieldValue === "string" ? "characters" : "";
    if (!this.checkError() && isType !== "") {
      this.error =
        this.fieldValue.length === 0
          ? { hasError: true, message: `${this.fieldName} is empty` }
          : { hasError: false, name: this.fieldName, value: this.fieldValue };
    }

    return this;
  }

  maxLength(max_value: any): this {
    const isType = Array.isArray(this.fieldValue) ? "array" : typeof this.fieldValue === "string" ? "characters" : "";
    if (!this.checkError() && isType !== "") {
      this.error =
        this.fieldValue.length <= max_value
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : { hasError: true, message: `${this.fieldName} must not be exceed to ${max_value} ${isType} long!` };
    }
    return this;
  }

  minLength(min_value: any): this {
    const isType = Array.isArray(this.fieldValue) ? "array" : typeof this.fieldValue === "string" ? "characters" : "";
    if (!this.checkError() && isType !== "") {
      this.error =
        this.fieldValue.length >= min_value
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : { hasError: true, message: `${this.fieldName} must be ${min_value} ${isType} long!` };
    }
    return this;
  }
  isArray(): this {
    if (!this.checkError()) {
      this.error =
        Array.isArray(this.fieldValue) && 0 < this.fieldValue.length
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : { hasError: true, message: `${this.fieldName} only accepts an Array.` };
    }
    return this;
  }

  isAlpha(): this {
    if (!this.checkError()) {
      this.error = this.fieldValue.match(/^[a-zA-Z]*$/)
        ? { hasError: false, name: this.fieldName, value: this.fieldValue }
        : { hasError: true, message: `${this.fieldName} only accepts letters.` };
    }
    return this;
  }

  isString(): this {
    if (!this.checkError()) {
      this.error =
        typeof this.fieldValue === "string"
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : { hasError: true, message: `${this.fieldName} must be a string type.` };
    }
    return this;
  }

  isBool(): this {
    if (!this.checkError()) {
      this.error =
        typeof this.fieldValue === "boolean"
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : { hasError: true, message: `${this.fieldName} must be a boolean type.` };
    }
    return this;
  }

  isObject(): this {
    if (!this.checkError()) {
      this.error =
        !Array.isArray(this.fieldValue) && typeof this.fieldValue === "object"
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : { hasError: true, message: `${this.fieldName} must be an object type.` };
    }
    return this;
  }

  isJSON(): this {
    if (!this.checkError()) {
      try {
        this.error =
          JSON.parse(this.fieldValue) && !!this.fieldValue
            ? { hasError: false, name: this.fieldName, value: this.fieldValue }
            : { hasError: true, message: `${this.fieldName} must be a valid JSON.` };
      } catch (e) {
        this.error = { hasError: true, message: `${this.fieldName} must be a valid JSON.` };
      }
    }
    return this;
  }

  isNum(): this {
    if (!this.checkError()) {
      this.error =
        typeof this.fieldValue === "number"
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : { hasError: true, message: `${this.fieldName} only accepts numbers.` };
    }
    return this;
  }

  isAlphaNum(): this {
    this.isString();
    if (!this.checkError()) {
      this.error = this.fieldValue.match(/^[a-zA-Z0-9]+$/i)
        ? { hasError: false, name: this.fieldName, value: this.fieldValue }
        : { hasError: true, message: `${this.fieldName} only accepts letters and number.` };
    }
    return this;
  }

  isEmail(): this {
    if (!this.checkError()) {
      // tslint:disable-next-line: max-line-length
      const regExEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      this.error = regExEmail.test(String(this.fieldValue).toLowerCase())
        ? { hasError: false, name: this.fieldName, value: this.fieldValue }
        : { hasError: true, message: `${this.fieldName} is not a valid email.` };
    }
    return this;
  }

  isBase64(): this {
    this.isString();
    if (!this.checkError()) {
      const regExBase64 = /^[a-zA-Z0-9+\=\/]+$/i;
      this.error = regExBase64.test(this.fieldValue)
        ? { hasError: false, name: this.fieldName, value: this.fieldValue }
        : { hasError: true, message: `${this.fieldName} is not a base64 format` };
    }
    return this;
  }

  /**
   * For custom RegEx validation.
   * Usage: isRegExValid(/^[^a-z]*$/, "Value must be all caps.").
   * @param {RegExp} regEx - The regEx condition.
   * @param {string} message - The custom error message.
   */
  isRegExValid(regEx: any, message: string): this {
    this.isString();
    if (!this.checkError()) {
      this.error = new RegExp(regEx).test(this.fieldValue) ? { hasError: false, name: this.fieldName, value: this.fieldValue } : { hasError: true, message };
    }
    return this;
  }

  isPassword(): this {
    return this.isRegExValid(
      /((?=.*\d)(?=.*[A-Z])(?=.*\W))/,
      `${this.fieldName} must contains at least one digit, one uppercase character and one special symbol.`
    );
  }

  matchPassword(password: any, retyPassword: any): this {
    if (!this.checkError()) {
      this.error =
        password === retyPassword ? { hasError: false, name: this.fieldName, value: this.fieldValue } : { hasError: true, message: `Password must match.` };
    }
    return this;
  }

  isPhone(): this {
    return this.isRegExValid(
      /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im,
      `${this.fieldName} must be in a valid phone format e.g (XXX) XXX-XXXX`
    );
  }

  isAddress(): this {
    return this.isRegExValid(/^[a-zA-Z0-9.\s,'-]*$/, `${this.fieldName} must be a valid address`);
  }
  isDate(): this {
    if (!this.checkError()) {
      this.error = DateHelper.checkFormat(this.fieldValue)
        ? { hasError: false, name: this.fieldName, value: this.fieldValue }
        : { hasError: true, message: `${this.fieldName} must be in YYYY-MM-DD date format.` };
    }
    return this;
  }

  isTime(): this {
    return this.isRegExValid(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, `${this.fieldName} must be a valid time format e.g 00:00`);
  }

  isURL(): this {
    return this.isRegExValid(/^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/i, `${this.fieldName} must be a valid URL`);
  }

  isMongoObjId(): this {
    if (!this.checkError()) {
      this.fieldValue = this.fieldValue.includes("=") ? this.fieldValue.split("=")[1] : this.fieldValue;
      this.error = Types.ObjectId.isValid(this.fieldValue)
        ? { hasError: false, name: this.fieldName, value: this.fieldValue }
        : { hasError: true, message: `${this.fieldName} is must be a valid Object Id` };
    }
    return this;
  }

  isValidParams(allowedParams: any): this {
    if (!this.error["hasError"]) {
      const invalidProps = [];
      for (const key in this.body) {
        if (!allowedParams.hasOwnProperty(key) && !allowedParams.dbFields.includes(key)) {
          invalidProps.push(key);
        }
      }

      this.error =
        invalidProps.length === 0
          ? { hasError: false, name: this.fieldName, value: this.fieldValue }
          : {
              hasError: true,
              message: `${invalidProps.join(", ")} ${invalidProps.length === 1 ? "is" : "are"} invalid parameter${invalidProps.length === 1 ? "" : "s"}.`,
            };
    }
    return this;
  }

  isOptional(): this {
    const field = this.body[this.fieldName];
    this.error = { hasError: false, name: this.fieldName, value: this.fieldValue };
    return this;
  }
}
