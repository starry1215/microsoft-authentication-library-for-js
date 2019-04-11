// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Constants } from "./Constants";
import { AccessTokenCacheItem } from "./AccessTokenCacheItem";
import { CacheKeys } from "./Constants";

/**
 * Singleton
 * @hidden
 */
export class Storage {

  private static instance: Storage;
  private localStorageSupported: boolean;
  private sessionStorageSupported: boolean;
  private cacheLocation: string;

  constructor(cacheLocation: string) {
    if (Storage.instance) {
      return Storage.instance;
    }

    this.cacheLocation = cacheLocation;
    this.localStorageSupported = typeof window[this.cacheLocation] !== "undefined" && window[this.cacheLocation] != null;
    this.sessionStorageSupported = typeof window[cacheLocation] !== "undefined" && window[cacheLocation] != null;
    Storage.instance = this;
    if (!this.localStorageSupported && !this.sessionStorageSupported) {
      throw new Error("localStorage and sessionStorage not supported");
    }

    return Storage.instance;
  }

    /**
     * add value to storage
     * @param key
     * @param value
     * @param enableCookieStorage
     */
    setItem(key: string, value: string, enableCookieStorage?: boolean): void {
        if (window[this.cacheLocation]) {
            window[this.cacheLocation].setItem(key, value);
        }
        if (enableCookieStorage) {
            this.setItemCookie(key, value);
        }
    }

    /**
     * get one item by key from storage
     * @param key
     * @param enableCookieStorage
     */
    getItem(key: string, enableCookieStorage?: boolean): string {
        if (enableCookieStorage && this.getItemCookie(key)) {
            return this.getItemCookie(key);
        }
        if (window[this.cacheLocation]) {
            return window[this.cacheLocation].getItem(key);
        }
        return null;
    }

    /**
     * remove value from storage
     * @param key
     */
    removeItem(key: string): void {
        if (window[this.cacheLocation]) {
            return window[this.cacheLocation].removeItem(key);
        }
    }

    /**
     * clear storage (remove all items from it)
     */
    clear(): void {
        if (window[this.cacheLocation]) {
            return window[this.cacheLocation].clear();
        }
    }

    /**
     * Retrieve all the accessTokens from the cache
     * @param clientId
     * @param homeAccountIdentifier
     */
    getAllAccessTokens(clientId: string, homeAccountIdentifier: string): Array<AccessTokenCacheItem> {
        const results: Array<AccessTokenCacheItem> = [];
        let accessTokenCacheItem: AccessTokenCacheItem;
        const storage = window[this.cacheLocation];
        if (storage) {
            let key: string;
            for (key in storage) {
                if (storage.hasOwnProperty(key)) {
                    if (key.match(clientId) && key.match(homeAccountIdentifier)) {
                        const value = this.getItem(key);
                        if (value) {
                            accessTokenCacheItem = new AccessTokenCacheItem(JSON.parse(key), JSON.parse(value));
                            results.push(accessTokenCacheItem);
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Remove account and authority information from the cache
     * @param authorityKey
     * @param acquireTokenAccountKey
     */
    removeAcquireTokenEntries(authorityKey: string, acquireTokenAccountKey: string): void {
        const storage = window[this.cacheLocation];
        if (storage) {
            let key: string;
            for (key in storage) {
                if (storage.hasOwnProperty(key)) {
                    if ((authorityKey !== "" && key.indexOf(authorityKey) > -1) || (acquireTokenAccountKey !== "" && key.indexOf(acquireTokenAccountKey) > -1)) {
                        this.removeItem(key);
                    }
                }
            }
        }
    }

    /**
     * reset cache
     */
    resetCacheItems(): void {
        const storage = window[this.cacheLocation];
        if (storage) {
            let key: string;
            for (key in storage) {
                if (storage.hasOwnProperty(key)) {
                    if (key.indexOf(Constants.msal) !== -1) {
                        this.setItem(key, "");
                    }
                    if (key.indexOf(Constants.renewStatus) !== -1) {
                        this.removeItem(key);
                    }
                }
            }
        }
    }

    /**
     * store an item in the cookies
     * @param cName
     * @param cValue
     * @param expires
     */
    setItemCookie(cName: string, cValue: string, expires?: number): void {
        let cookieStr = cName + "=" + cValue + ";";
        if (expires) {
            const expireTime = this.setExpirationCookie(expires);
            cookieStr += "expires=" + expireTime + ";";
        }

        document.cookie = cookieStr;
    }

    /**
     * retrieve a cache item from cookies
     * @param cName
     */
    getItemCookie(cName: string): string {
        const name = cName + "=";
        const ca = document.cookie.split(";");
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === " ") {
                c = c.substring(1);
            }
            if (c.indexOf(name) === 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }

    /**
     * set the expiry for cookies
     * @param cookieLife
     */
    setExpirationCookie(cookieLife: number): string {
        const today = new Date();
        const expr = new Date(today.getTime() + cookieLife * 24 * 60 * 60 * 1000);
        return expr.toUTCString();
    }

    /**
     * clear all cookies stored
     */
    clearCookie(): void {
        this.setItemCookie(Constants.nonceIdToken, "", -1);
        this.setItemCookie(Constants.stateLogin, "", -1);
        this.setItemCookie(Constants.loginRequest, "", -1);
        this.setItemCookie(Constants.stateAcquireToken, "", -1);
    }

    /**
     * Create acquireTokenAccountKey to cache account object
     * @param accountId
     * @param state
     */
    static generateAcquireTokenAccountKey(accountId: any, state: string): string {
        return CacheKeys.ACQUIRE_TOKEN_USER + Constants.resourceDelimiter +
            `${accountId}` + Constants.resourceDelimiter  + `${state}`;
    }

    /**
     * Create authorityKey to cache authority
     * @param state
     */
    static generateAuthorityKey(state: string): string {
        return CacheKeys.AUTHORITY + Constants.resourceDelimiter + `${state}`;
    }
}
