import { isValid } from "mailchecker";
import axios from "axios";
import { resolve } from "bluebird";
export class EmailChecker {
  private HOST = "https://login.yahoo.com";
  private SIGNUP_PAGE = "/account/create?specId=yidReg&lang=en-US&src=&done=https%3A%2F%2Fwww.yahoo.com&display=login";
  private SIGNUP_API = "/account/module/create?validateField=yid";
  private USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36"; // Fake one to use in API requests

  constructor() {}
  check(email: string): Promise<boolean> {
    email = email.toLowerCase();

    return new Promise(resolve => {
      if (isValid(email)) {
        const domain = email.split("@")[1];
        if (domain === "yahoo.com" || domain === "yahoomail.com" || domain === "ymail.com") {
          // this.checkYahooEmail(email)
          //   .then(res => {
          //     resolve(res);
          //   })
          //   .catch(err => {
          //     resolve(false);
          //   });
          resolve(true);
        } else {
          this.checkNonYahooEmail(email)
            .then(res => {
              resolve(res);
            })
            .catch(err => {
              resolve(false);
            });
        }
      } else {
        resolve(false);
      }
    });
  }

  private checkNonYahooEmail(email: string): Promise<boolean> {
    return new Promise(resolve => {
      axios
        .post(
          "https://open-source-email-checker.herokuapp.com/v0/check_email",
          { to_email: email },
          {
            headers: {
              "x-saasify-proxy-secret": "reacher_dev_secret",
            },
            timeout: 20000,
          }
        )
        .then(resp => {
          resolve(resp.data.is_reachable !== "invalid");
        })
        .catch(error => {
          console.log("hy", "error", error.message);
          resolve(false);
        });
    });
  }
  private checkYahooEmail(email: string): Promise<boolean> {
    return new Promise(resolve => {
      const strArray = email.split("@");
      const username = strArray[0];
      axios
        .get(this.HOST + this.SIGNUP_PAGE, {
          headers: {
            "User-Agent": this.USER_AGENT,
          },
        })
        .then(res => {
          const acrumb = res.headers["set-cookie"][0].match(/s=([\w\d]*[^;]*)/)[1];
          axios
            .post(
              this.HOST + this.SIGNUP_API,
              "browser-fp-data=%7B%22language%22%3A%22en-US%22%2C%22colorDepth%22%3A24%2C%22deviceMemory%22%3A8%2C%22pixelRatio%22%3A1%2C%22hardwareConcurrency%22%3A12%2C%22timezoneOffset%22%3A-480%2C%22timezone%22%3A%22Asia%2FManila%22%2C%22sessionStorage%22%3A1%2C%22localStorage%22%3A1%2C%22indexedDb%22%3A1%2C%22openDatabase%22%3A1%2C%22cpuClass%22%3A%22unknown%22%2C%22platform%22%3A%22Linux%20x86_64%22%2C%22doNotTrack%22%3A%22unknown%22%2C%22plugins%22%3A%7B%22count%22%3A3%2C%22hash%22%3A%22e43a8bc708fc490225cde0663b28278c%22%7D%2C%22canvas%22%3A%22canvas%20winding%3Ayes~canvas%22%2C%22webgl%22%3A1%2C%22webglVendorAndRenderer%22%3A%22Google%20Inc.~Google%20SwiftShader%22%2C%22adBlock%22%3A0%2C%22hasLiedLanguages%22%3A0%2C%22hasLiedResolution%22%3A0%2C%22hasLiedOs%22%3A0%2C%22hasLiedBrowser%22%3A0%2C%22touchSupport%22%3A%7B%22points%22%3A0%2C%22event%22%3A0%2C%22start%22%3A0%7D%2C%22fonts%22%3A%7B%22count%22%3A6%2C%22hash%22%3A%22a47f92313962bbf44c995c3cea117b12%22%7D%2C%22audio%22%3A%22124.04347730590962%22%2C%22resolution%22%3A%7B%22w%22%3A%221920%22%2C%22h%22%3A%221080%22%7D%2C%22availableResolution%22%3A%7B%22w%22%3A%221045%22%2C%22h%22%3A%221920%22%7D%2C%22ts%22%3A%7B%22serve%22%3A1618437170530%2C%22render%22%3A1618437171402%7D%7D&specId=yidreg&cacheStored=&crumb=9pSaWFJfByy&" +
                "acrumb=" +
                acrumb +
                "&done=https%3A%2F%2Fwww.yahoo.com&googleIdToken=&authCode=&attrSetIndex=0&specData=&tos0=oath_freereg%7Cph%7Cen-PH&firstName=&lastName=&" +
                "yid=" +
                username +
                "&password=&shortCountryCode=PH&phone=&mm=&dd=&yyyy=&freeformGender=&signup=",

              {
                headers: {
                  Origin: "https://login.yahoo.com",
                  "X-Requested-With": "XMLHttpRequest",
                  "User-Agent": this.USER_AGENT,
                  "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                  Accept: "*/*",
                  Referer: this.HOST + this.SIGNUP_PAGE,
                  "Accept-Encoding": "gzip, deflate, br",
                  "Accept-Language": "en-US,en;q=0.8,ar;q=0.6",
                  Cookie: res.headers["set-cookie"].map((e: string) => e.split(";")[0]).join("; "),
                },
              }
            )
            .then(resp => {
              const yid = resp.data.errors.find((e: { name: string }) => e.name === "yid");
              if (yid) {
                resolve(yid.error === "IDENTIFIER_EXISTS");
              } else {
                resolve(false);
              }
            })
            .catch(error => {
              resolve(false);
              console.log("yahoo 2", email, error);
            });
        })
        .catch(error => {
          resolve(false);
          console.log("yahoo 1", email, error);
        });
    });
  }
}
