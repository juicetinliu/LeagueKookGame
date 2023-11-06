export function generateRandomString(length, charPool) {
    let out = '';
    const charactersLength = charPool.length;
    for(let i = 0; i < length; i++) {
      out += charPool.charAt(Math.floor(Math.random() * charactersLength));
    }
    return out;
}