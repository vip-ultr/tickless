"use client";

import { useEffect } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";

/**
 * GDPR cookie consent (vanilla-cookieconsent), brand-styled via CSS vars.
 * Categories: necessary (always on), analytics, advertising.
 * Ad/analytics cookies only fire after opt-in.
 */
export function ConsentBanner() {
  useEffect(() => {
    CookieConsent.run({
      guiOptions: {
        consentModal: { layout: "box", position: "bottom right" },
        preferencesModal: { layout: "box" },
      },
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: {},
        advertising: {},
      },
      language: {
        default: "en",
        translations: {
          en: {
            consentModal: {
              title: "Cookies at Tickless",
              description:
                "We use a few cookies to understand traffic and, later, to support ads that keep Tickless free. You choose what is allowed.",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Only necessary",
              showPreferencesBtn: "Manage choices",
            },
            preferencesModal: {
              title: "Cookie choices",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Only necessary",
              savePreferencesBtn: "Save choices",
              sections: [
                {
                  title: "Strictly necessary",
                  description: "Needed for the site to work. Always on.",
                  linkedCategory: "necessary",
                },
                {
                  title: "Analytics",
                  description: "Anonymous stats that show us what to improve.",
                  linkedCategory: "analytics",
                },
                {
                  title: "Advertising",
                  description: "Allows ad performance measurement. Ads keep Tickless free.",
                  linkedCategory: "advertising",
                },
              ],
            },
          },
        },
      },
    });
  }, []);

  return null;
}
