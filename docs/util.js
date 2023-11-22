export function generateRandomString(length, charPool) {
    let out = '';
    const charactersLength = charPool.length;
    for(let i = 0; i < length; i++) {
      out += charPool.charAt(Math.floor(Math.random() * charactersLength));
    }
    return out;
}

export function getRandomElementFromArray(array) {
  if(!array || !array.length) return null;
  return array[Math.floor(Math.random()*array.length)];
}

export function popRandomElementFromArray(array) {
  if(!array || !array.length) return null;
  return array.splice(Math.floor(Math.random()*array.length), 1)[0];
}