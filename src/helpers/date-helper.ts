export class DateHelper {
  static addDays(date: Date, noOfDays: number): Date {
    return new Date(new Date(date).setDate(new Date(date).getDate() + noOfDays));
  }

  static setQueryDateMongo(date: string, dateTo?: string): { $gte: Date } {
    const isGreaterThan = dateTo && dateTo === "0000-00-00";
    const dateQry: any = { $gte: new Date(date) };
    if (!isGreaterThan) {
      dateQry.$lt = DateHelper.addDays(dateTo ? new Date(dateTo) : new Date(date), 1);
    }
    return dateQry;
  }

  /**
   * Checks date format in YYYY-MM-DD
   * @param {String} dateString The date to be checked.
   * @return True, if the date is in the valid date format.
   */
  static checkFormat(dateString: string, allowInfiniteDate: boolean = true): boolean {
    const regEx = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regEx)) {
      return false;
    }
    if (!allowInfiniteDate) {
      const d = new Date(dateString);
      if (Number.isNaN(d.getTime())) {
        return false;
      }
      return d.toISOString().slice(0, 10) === dateString;
    }
    return true;
  }

  formatDate(date: string = new Date().toString()): string {
    const now = new Date(date);
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
      .getDate()
      .toString()
      .padStart(2, "0")}`;
  }

  formatDateforDirectory(dateString: string): string {
    const date = new Date(dateString);
    return `${this.getMonth(date)}-${this.getDay(date)}-${date.getFullYear()}`;
  }

  private getDay(date: Date): string {
    return `00${date.getDate()}`.slice(-2);
  }

  private getMonth(date: Date): string {
    return `00${date.getMonth() + 1}`.slice(-2);
  }
}
