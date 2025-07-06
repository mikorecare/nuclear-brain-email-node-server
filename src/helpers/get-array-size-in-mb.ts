export const getArraySizeInMB = (arr: Array<any>) => {
  let totalBytes = 0;

  for (const element of arr) {
    if (typeof element === "number") {
      totalBytes += 8;
    } else if (typeof element === "string") {
      totalBytes += element.length * 2;
    } else if (typeof element === "boolean") {
      totalBytes += 4;
    } else if (typeof element === "object") {
      totalBytes += 4;
      try {
        totalBytes += JSON.stringify(element).length * 2;
      } catch (e) {}
    } else if (element === null || element === undefined) {
      totalBytes += 4;
    }
  }

  return totalBytes / (1024 * 1024);
};
