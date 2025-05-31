export const chunk = (arr: Array<any>, n: number) => {
  const rest = arr.length % n;
  let restUsed = rest;
  const partLength = Math.floor(arr.length / n);
  const result = [];

  for (let i = 0; i < arr.length; i += partLength) {
    let end = partLength + i,
      add = false;

    if (rest !== 0 && restUsed) {
      end++;
      restUsed--;
      add = true;
    }

    result.push(arr.slice(i, end));
    if (add) {
      i++;
    }
  }

  return result;
};
