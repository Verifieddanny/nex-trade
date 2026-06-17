import CryptoJS from "crypto-js";
import { config } from "../config";

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, config.encryptionKey).toString();
}

export function decrypt(cipherText: string): string {
  const bytes = CryptoJS.AES.decrypt(cipherText, config.encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}
