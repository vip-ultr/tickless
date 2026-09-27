"use client";

import { useEffect } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
// The stylesheet lives in globals.css (imported before the #cc-main overrides)
// so our card styling deterministically wins over the library's defaults.

/**
 * GDPR cookie consent (vanilla-cookieconsent), brand-styled via CSS vars.
 * Categories: necessary (always on), analytics, advertising.
 * Ad/analytics cookies only fire after opt-in.
 *
 * First layer is deliberately TWO equal-weight buttons (Accept / Reject) plus a
 * text link into the preferences modal that sits in the copy block — the
 * layered pattern the EDPB recommends and the one top products ship. Reject
 * must be exactly as easy as Accept (CNIL has fined Google/Meta/Microsoft for
 * asymmetry on this), and the top-right ✕ dismisses the card as a rejection.
 * `equalWeightButtons: false` only gives Reject the `--secondary` *class* so it
 * can be outlined; globals.css keeps both buttons identical in size/weight.
 * All styling lives in globals.css under `#cc-main`.
 */
export function ConsentBanner() {
  useEffect(() => {
    CookieConsent.run({
      guiOptions: {
        consentModal: {
          layout: "box",
          position: "bottom right",
          equalWeightButtons: false,
        },
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
              // "Manage choices" lives INSIDE the copy, right under the
              // sentence it belongs to, instead of floating as a third,
              // centred pseudo-button under the action row. `data-cc` is the
              // library's own hook and it is re-bound against `.cm__body`
              // when the modal HTML is generated, so the element is live.
              description:
                "We use a few cookies for traffic and, later, ads that keep Tickless free. " +
                "You choose what's allowed." +
                '<button type="button" class="cc-manage" data-cc="show-preferencesModal">Manage choices</button>',
              // Top-right ✕. vanilla-cookieconsent wires it to
              // `hide()` + `acceptCategory([])`, so dismissing the card is
              // the same as rejecting: no optional cookie is set.
              closeIconLabel: "Close cookie notice",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
            },
            preferencesModal: {
              title: "Cookie choices",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
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
