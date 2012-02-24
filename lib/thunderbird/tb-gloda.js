/***************************** BEGIN LICENSE BLOCK *****************************
* Version: MPL 1.1/GPL 2.0/LGPL 2.1
*
* The contents of this file are subject to the Mozilla Public License Version
* 1.1 (the "License"); you may not use this file except in compliance with the
* License. You may obtain a copy of the License at http://www.mozilla.org/MPL/
*
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for
* the specific language governing rights and limitations under the License.
*
* The Original Code is Thunderbird Jetpack Functionality.
*
* The Initial Developer of the Original Code is Mozilla Messaging, Inc.
* Portions created by the Initial Developer are Copyright (C) 2009 the Initial
* Developer. All Rights Reserved.
*
* Contributor(s):
*  Andrew Sutherland <asutherland@asutherland.org> (Original Author)
*
* Alternatively, the contents of this file may be used under the terms of either
* the GNU General Public License Version 2 or later (the "GPL"), or the GNU
* Lesser General Public License Version 2.1 or later (the "LGPL"), in which case
* the provisions of the GPL or the LGPL are applicable instead of those above.
* If you wish to allow use of your version of this file only under the terms of
* either the GPL or the LGPL, and not to allow others to use your version of
* this file under the terms of the MPL, indicate your decision by deleting the
* provisions above and replace them with the notice and other provisions
* required by the GPL or the LGPL. If you do not delete the provisions above, a
* recipient may use your version of this file under the terms of any one of the
* MPL, the GPL or the LGPL.
*
****************************** END LICENSE BLOCK ******************************/

/*
 * Provide the magic of gloda to jetpack with new convenience logic.
 */

Components.utils.import("resource://app/modules/gloda/public.js");

let TbGlodaFriendlyUtils = {
  /**
   * Simplify using 'fromMe' by dealing with the identity cartesian product
   *  issue in queries; find all messages from me to the other person.
   *
   * This is the kind of thing that needs to be exposed directly on the query
   *  via our helper mechanism.
   *
   * @param aRecipientContact The other person.
   */
  queryCartesianProductFromMe: function(aQuery, aRecipientContact) {
    let tupes = [];
    for each (let [, myIdent] in Iterator(Gloda.myContact.identities)) {
      for each (let [, theirIdent] in Iterator(aRecipientContact.identities)) {
        // the 'me' ident always goes first
        tupes.push([myIdent, theirIdent]);
      }
    }
    aQuery.fromMe.apply(aQuery, tupes);
  },

  /**
   * Simplify using 'toMe' by dealing with the identity cartesian product
   *  issue in queries; find all messages to me from the other person.
   *
   * This is the kind of thing that needs to be exposed directly on the query
   *  via our helper mechanism.
   *
   * @param aOriginContact The other person.
   */
  queryCartesianProductToMe: function(aQuery, aOriginContact) {
    let tupes = [];
    for each (let [, myIdent] in Iterator(Gloda.myContact.identities)) {
      for each (let [, theirIdent] in Iterator(aOriginContact.identities)) {
        // the 'me' ident always goes first
        tupes.push([myIdent, theirIdent]);
      }
    }
    aQuery.toMe.apply(aQuery, tupes);
  },

  INTERVAL_YEARS: 0,
  INTERVAL_MONTHS: -1,
  INTERVAL_DAYS: -2,
  INTERVAL_HOURS: -3,
  INTERVAL_MINUTES: -4,
  INTERVAL_SECONDS: -5,
  INTERVAL_MILLISECONDS: -6,
  INTERVAL_WEEKS: -10,
  INTERVAL_QUARTERS: -12,
  /**
   * Round dates.
   *
   * This code is derived from the deprecated protovis DateTimeScale.round
   *  method, but with some fixes/changes made for the version of protovis we
   *  initially landed in Thunderbird.  (Protovis 2.8).
   */
  _dateRound: function _dateRound(d, aInterval, aRoundUp) {
    let t = d, bias = aRoundUp ? 1 : 0;

    if (aInterval >= this.INTERVAL_YEARS) {
      d = new Date(t.getFullYear() + bias, 0);
    } else if (aInterval == this.INTERVAL_MONTHS) {
      d = new Date(t.getFullYear(), t.getMonth() + bias);
    } else if (aInterval == this.INTERVAL_DAYS) {
      d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + bias);
    } else if (aInterval == this.INTERVAL_HOURS) {
      d = new Date(t.getFullYear(), t.getMonth(), t.getDate(),
                   t.getHours() + bias);
    } else if (aInterval == this.INTERVAL_MINUTES) {
      d = new Date(t.getFullYear(), t.getMonth(), t.getDate(),
                   t.getHours(), t.getMinutes() + bias);
    } else if (aInterval == this.INTERVAL_SECONDS) {
      d = new Date(t.getFullYear(), t.getMonth(), t.getDate(),
                   t.getHours(), t.getMinutes(), t.getSeconds() + bias);
    } else if (aInterval == this.INTERVAL_MILLISECONDS) {
      d = new Date(d.time + (roundUp ? 1 : -1));
    } else if (aInterval == this.INTERVAL_WEEKS) {
      bias = roundUp ? 7 - d.getDay() : -d.getDay();
      d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + bias);
    }
    return d;
  },

  _dateStep: function _dateStep(aInterval) {
    if (aInterval > this.INTERVAL_YEARS) {
      var exp = Math.round(Math.log(Math.max(1,aInterval-1)/Math.log(10))) - 1;
      return Math.pow(10, exp);
    } else if (aInterval == this.INTERVAL_MONTHS) {
      return 0;
    } else if (aInterval == this.INTERVAL_WEEKS) {
      return 7*24*60*60*1000;
    } else if (aInterval == this.INTERVAL_DAYS) {
      return 24*60*60*1000;
    } else if (aInterval == this.INTERVAL_HOURS) {
      return 60*60*1000;
    } else if (aInterval == this.INTERVAL_MINUTES) {
      return 60*1000;
    } else if (aInterval == this.INTERVAL_SECONDS) {
      return 1000;
    } else {
      return 1;
    }
  },

  /**
   * Given two dates and an interval, generate a list of date values that
   *  constitute the boundaries
   *
   * This code is derived from the deprecated protovis DateTimeScale.ruleValues
   *  method, but with some fixes/changes made for the version of protovis we
   *  initially landed in Thunderbird.  (Protovis 2.8).
   */
  _dateRules: function _dateRules(aMinDate, aMaxDate, aInterval) {
    // We need to boost the step in order to avoid an infinite loop in the first
    //  case where we round.  DST can cause a case where just one step is not
    //  enough to push round far enough.
    let step = Math.floor(this._dateStep(aInterval) * 1.5);
    let list = [];

    let d = this._dateRound(aMinDate, aInterval, false);
    let max = this._dateRound(aMaxDate, aInterval, true).valueOf();

    if (aInterval < this.INTERVAL_MONTHS) {
      while (d.valueOf() <= max) {
        list.push(d);
        // we need to round to compensate for daylight savings time...
        d = this._dateRound(new Date(d.valueOf()+step), aInterval, false);
      }
    } else if (aInterval == this.INTERVAL_MONTHS) {
      // TODO: Handle quarters
      step = 1;
      while (d.valueOf() <= max) {
        list.push(d);
        d = new Date(d);
        d.setMonth(d.getMonth() + step);
      }
    } else { // Span.YEARS
      step = 1;
      while (d.valueOf() <= max) {
        list.push(d);
        d = new Date(d);
        d.setFullYear(d.getFullYear() + step);
      }
    }

    return list;
  },


  /**
   * Given a list of messages, bin them down to some level of time granularity.
   *
   * This is derived from glodaFacetVis' binBySpan method.
   *
   * @note You are responsible for making sure you hold onto the gloda
   *  collection that is keeping the messages alive.
   *
   * @param aMessages The list of messages.
   * @param aInterval The granularity at which to bin.  If you pass
   *     |INTERVAL_YEARS|, we bin messages by year.  If you pass
   *     |INTERVAL_MONTHS|, we bin messages by year and month (Jan 2000 gets
   *     a different bucket than Jan 2001).
   * @param aIncludeEmpties Should we
   *
   * @return The list of message bins in ascending time order.  Each bin is
   *     actually an object of the form {items, startDate, endDate}.
   */
  binMessagesByDate: function(aMessages, aInterval, aIncludeEmpties) {
    let binMap = {};
    let binList = [];

    // Run through all the messages, binning them into buckets as we go.
    // Create buckets that do not exist on the way.
    for each (let [, item] in Iterator(aMessages)) {
      let date = item.date;

      // round it (down) to map it to its bin
      date = this._dateRound(date, aInterval, false);
      // which we can then map to a bin
      let binName = date.valueOf().toString();
      if (binName in binMap) {
        binMap[binName].items.push(item);
      }
      else {
        let bin = {
          items: [item],
          startDate: date,
          // round up for the end date
          endDate: this._dateRound(item.date, aInterval, true),
        };
        binMap[binName] = bin;
        binList.push(bin);
      }
    }

    // If the user wants empties, scan through the buckets and find the first
    // and last bucket (by time), and use that to generate a set of rules
    // covering the desired time period.  Then scan through the set of rules
    // performing lookups and creating empty buckets as required.
    if (aIncludeEmpties) {

    }
    // No empties, but we do need to sort the bins.
    else {
      binList.sort(function(a, b) {
                  return a.startDate - b.startDate;
                });
    }

    return binList;
  },

  /**
   * Given multiple sets of binned results from |binMessagesByDate|, fuse them
   *  into a single list of bins that has attributes for each of the sources.
   *  So if you provide lists 'a' and 'b' (as named in aNameToBinList), then
   *  each bin will have the attributes {a, b, startDate, endDate}.
   */
  fuseBins: function(aNameToBinList) {
    let resultBins = [];

    // - Clone the lists (which we know to be ordered) so we can pop from them
    let sourceBins = {};
    for each (let [attrName, bins] in Iterator(aNameToBinList)) {
      sourceBins[attrName] = bins.concat();
    }

    // -- (We are done when all the lists are empty.)
    while (true) {
      // - Find the earliest date provided by a bin.
      let earliestDate = null;
      for each (let [attrName, bins] in Iterator(sourceBins)) {
        if (!bins.length)
          continue;
        let binEarliest = bins[0].startDate;
        if (earliestDate == null || binEarliest < earliestDate)
          earliestDate = binEarliest;
      }
      // there must have been no beens left!
      if (earliestDate == null)
        break;

      // - Create a bin containing all of the bins that started with that date.
      let resultBin = { startDate: earliestDate };
      resultBins.push(resultBin);
      for each (let [attrName, bins] in Iterator(sourceBins)) {
        if (!bins.length) {
          resultBin[attrName] = [];
          continue;
        }
        let curBin = bins[0];
        if (curBin.startDate.valueOf() == earliestDate.valueOf()) {
          resultBin.endDate = curBin.endDate;
          resultBin[attrName] = curBin.items;
          // (remove the bin from the bin list)
          bins.shift();
        }
        else {
          resultBin[attrName] = [];
        }
      }
    }

    return resultBins;
  }
};

/**
 * Given a query that returns contacts, retrieves the messages personally
 *  associated with that contact (up to the provided limit).
 */
function ContactHistoryChainer(aContactReturningQuery,
                               aPerContactMessageLimit, aOpts) {
  this.perContactMessageLimit = aPerContactMessageLimit;
  this.opts = aOpts;

  this.contactCollection = aContactReturningQuery.getCollection(this);
  this.fromMeCollections = [];
  this.toMeCollections = [];
}
ContactHistoryChainer.prototype = {
  onItemsAdded: function() {
  },
  onItemsModified: function() {
  },
  onItemsRemoved: function() {
  },
  onQueryCompleted: function ContactHistoryChainer_onQueryCompleted(
      aCollection) {
    if (aCollection == this.contactCollection) {
      // filter ourselves out...
      aCollection.becomeExplicit();
      for each (let [iContact, contact] in Iterator(aCollection.items)) {
        if (contact == Gloda.myContact) {
          aCollection.items.splice(iContact, 1);
        }
      }
    }
    if (this.toMeCollections.length < this.contactCollection.items.length) {
      // -- We need to issue a message query.  But what kind?
      let messageQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
      messageQuery.limit(this.perContactMessageLimit);

      let otherContact =
        this.contactCollection.items[this.toMeCollections.length];

      // - Issue a fromMe query
      if (this.fromMeCollections.length == this.toMeCollections.length) {
        TbGlodaFriendlyUtils.queryCartesianProductFromMe(messageQuery,
                                                         otherContact);
        this.fromMeCollections.push(messageQuery.getCollection(this));
        return;
      }

      // - Issue a toMe query.
      TbGlodaFriendlyUtils.queryCartesianProductToMe(messageQuery,
                                                     otherContact);
      this.toMeCollections.push(messageQuery.getCollection(this));
      return;
    }

    // -- All data has been retrieved.  Process.
    // XXX probably should be time-sliced, possibly by pushing calculations
    //  up above so they happen just after the data is retrieved (although that
    //  might not be sufficient).
    let contactResults = [];
    for each (let [iCon, contact] in Iterator(this.contactCollection.items)) {
      let contactInfo = {
        contact: contact,
        fromMeCollection: this.fromMeCollections[iCon],
        toMeCollection: this.toMeCollections[iCon],
      };
      contactResults.push(contactInfo);

      // --- let's bin.

      // sparsely bin from me and to me
      let fromMeBins = TbGlodaFriendlyUtils.binMessagesByDate(
                         contactInfo.fromMeCollection.items,
                         TbGlodaFriendlyUtils.INTERVAL_MONTHS);
      let toMeBins = TbGlodaFriendlyUtils.binMessagesByDate(
                       contactInfo.toMeCollection.items,
                       TbGlodaFriendlyUtils.INTERVAL_MONTHS);
      // then fuse those
      contactInfo.byMonth = TbGlodaFriendlyUtils.fuseBins({
        fromMe: fromMeBins,
        toMe: toMeBins
      });
    }

    this.opts.onHistoryAvailable(contactResults);
  }
};

/**
 * Per-context gloda friendly wrapper.
 *
 * If we bothered to track memory usage, we would hold onto all collections
 *  created by us via a weak reference so we could tell if some jerk is keeping
 *  them alive or not.
 */
function TbFriendlyGlodaExported(aContext) {
  this.context = aContext;
  this.data = this.context.tb_gloda;
}
TbFriendlyGlodaExported.prototype = {
  /**
   * Get the top contacts and their history.
   *
   * @param [aOpts.limit=10]
   * @param [aOpts.facet=]
   * @param onHistoryAvailable
   */
  getTopContactsWithPersonalHistory: function(aOpts) {
    let contactLimit = 20;
    let perContactMessageLimit = 2500;
    if ("limit" in aOpts)
      contactLimit = aOpts.limit;

    let contactQuery = Gloda.newQuery(Gloda.NOUN_CONTACT);
    contactQuery.orderBy("-popularity").limit(contactLimit);
    let contactChainer = new ContactHistoryChainer(contactQuery,
                                                   perContactMessageLimit,
                                                   aOpts);
  },

  /**
   * Get the history of a contact
   */
  getContactPersonalHistory: function(aContactOrIdentity, aOpts) {
    throw new Error("not remotely implemented");
  },

  /**
   * Get recent conversations.
   */
  getRecentConversations: function(aOpts) {
    throw new Error("not remotely implemented");
  },
};

let TbFriendlyGloda = {
  /**
   * Create an export handle suitable for exposing to the Jetpack sandbox.
   */
  makeExported: function TbFriendlyGloda_makeExported(aContext) {
    aContext.addUnloader({
      unload: function() TbFriendlyGloda.decontextualize(aContext)
    });
    this.contextualize(aContext);
    return new TbFriendlyGlodaExported(aContext);
  },

  _contexts: [],
  /**
   * Attach tb_tabs info to the context and start tracking it for when new
   *  windows appear and cleanup purposes.
   */
  contextualize: function TbFriendlyGloda_contextualize(aContext) {
    aContext.tb_gloda = {
    };

    this._contexts.push(aContext);
  },

  /**
   * Cleanup when a jetpack context is going away by removing all of its
   *  live tab types and their tab instances.
   */
  decontextualize: function TbFriendlyGloda_decontextualize(aContext) {
    this._removeItem(this._contexts, aContext);
  },

  /**
   * Simple array helper to remove an item from a list if it's in the list.
   */
  _removeItem: function TbFriendlyGloda__removeItem(aArray, aItem) {
    let idx = aArray.indexOf(aItem);
    if (idx != -1)
      aArray.splice(idx, 1);
  },
};
