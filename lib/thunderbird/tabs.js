/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cu} = require("chrome");

var $winUtils = require("window-utils");
var $unload = require("unload");
var $self = require("self");

/**
 * Provide the ability to define new tab types.
 * This logic is ported from the Thunderbird feature work for the initial
 *  Jetpack prototype (tb-tabs.js).
 **/

  /**
   * @param aTabDef.name
   * @param [aTabDef.argDocs]
   * @param aTabDef.html
   * @param aTabDef.onTabOpened A function to be notified when an instance of
   *    your tab is created.
   * @param aTabDef.onTabClosed A function to be notified when an instance of
   *    your tab is being closed.
   */
exports.defineTabType = function defineTabType(aTabDef) {
  if (!("url" in aTabDef))
    throw new Error("You forgot your URL!");

  TbTabs.tabTypes.push(aTabDef);
  for each (let [, window] in Iterator(TbTabs.windows)) {
    TbTabs.registerTabTypeWithWindow(window, aTabDef);
  }
};

/**
 * Open a new tab in the current 3-pane window.
 */
exports.openTab = function(aTabModeName, aArgs) {
  let threePane = TbTabs.mostRecent3Pane;
  if (!threePane)
    return null;
  let tabmail = threePane.document.getElementById("tabmail");
  var realTab = tabmail.openTab(aTabModeName, aArgs);
  return new TabUserInstance(tabmail, realTab, null);
};

/**
 * This is what gets passed in to the tab's onReady method.
 *
 * This may need to change to a lexical closure OO idiom when security comes to
 *  town.
 */
function TabUserInstance(aTabmail, aTabInfo, aDoc) {
  this._tabmail = aTabmail;
  this._tabInfo = aTabInfo;
  this.contentDocument = aDoc;
}
TabUserInstance.prototype = {
  get title() {
    return this._tabInfo.title;
  },
  set title(aTitle) {
    this._tabInfo.title = aTitle;
    this._tabmail.setTabTitle(this._tabInfo);
  },

  get busy() {
    return this._tabInfo.busy;
  },
  set busy(aBusy) {
    this._tabmail.setTabBusy(this._tabInfo, aBusy);
  },

  get thinking() {
    return this._tabInfo.thinking;
  },
  set thinking(aThinking) {
    this._tabmail.setTabThinking(this._tabInfo, aThinking);
  },

  close: function TabUserInstance_close() {
    this._tabmail.closeTab(this._tabInfo);
  },

  select: function TabUserInstance_select() {
    this._tabmail.switchToTab(this._tabInfo);
  },
};

/**
 * Implement a tabmail-style tab implementation based on the provided tab
 *  definition.
 */
function TabDefWrapper(aTabmail, aTabTypeDef) {
  this.name = aTabTypeDef.name;

  // We define the bare minimum required for the modes.  We need the mode to
  //  exist since that is the actual 'atom' of tab definition, but we don't
  //  want to put anything else in it, like methods, because tabmail always
  //  forces "this" to be the tab type rather than the mode.
  this.modes = {};
  this.modes[aTabTypeDef.name] = {
    type: aTabTypeDef.name
  };

  this._tabmail = aTabmail;
  this._tabDef = aTabTypeDef;
}
TabDefWrapper.prototype = {
  perTabPanel: "iframe",
  /**
   * Our tab is being opened and our iframe element has been dynamically
   *  created (but the XBL binding is unlikely to have happened).
   */
  openTab: function TabDefWrapper_openTab(aTab, aArgs) {
    aTab.jettab = new TabUserInstance(this._tabmail, aTab, null);

    let contentUrl = this._tabDef.url;
    aTab.panel.setAttribute("src", contentUrl);

    let dis = this;
    let loadWrappy = function() {
      aTab.panel.contentWindow.removeEventListener("load", loadWrappy, false);
      aTab.jettab.contentDocument = aTab.panel.contentDocument;
      dis._tabDef.onTabOpened(aTab.jettab, aArgs);
    };
    aTab.panel.contentWindow.addEventListener("load", loadWrappy, false);
  },
  closeTab: function TabDefWrapper_closeTab(aTab) {
    if ("onTabClosed" in this._tabDef)
      this._tabDef.onTabClosed(aTab.jettab);
  },
  saveTabState: function(aTab) {
    if ("onTabHidden" in this._tabDef)
      this._tabDef.onTabHidden(aTab.jettab);
  },
  showTab: function(aTab) {
    if ("onTabVisible" in this._tabDef)
      this._tabDef.onTabVisible(aTab.jettab);
  },
};

/**
 * Thunderbird tabs are handled by tabmail, a per-window XBL binding.  So we
 *  use the standard BrowserWatcher idiom
 */
let TbTabs = {
  tabTypes: [],

  get mostRecent3Pane() {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
      getService(Ci.nsIWindowMediator);

    return wm.getMostRecentWindow("mail:3pane");
  },

  /**
   * All the windows we know about.  We need this so that if a jetpack defines
   *  a type when there are already open 3-pane windows we can bind to them.
   *
   * (We also could use a new WindowTracker for each tab type.)
   */
  windows: [],

  is3Pane: function(aWindow) {
    return aWindow.document.documentElement.getAttribute("windowtype") ===
      "mail:3pane";
  },

  /**
   * BrowserWatcher event that gets triggered when a new 3-pane shows up (or
   *  when we first startup and get told about all existing 3-panes.)
   */
  onTrack: function TbTabs_browserWatcher_onLoad(aWindow) {
    if (!this.is3Pane(aWindow))
      return;
    this.windows.push(aWindow);
    for each (let [, tabType] in Iterator(this.tabTypes)) {
      this.registerTabTypeWithWindow(aWindow, tabType);
    }
  },

  /**
   * BrowserWatcher event that gets triggered when a 3-pane is going away (or
   *  when we are shutting down.)
   */
  onUntrack: function TbTabs_browserWatcher_onUnload(aWindow) {
    if (!this.is3Pane(aWindow))
      return;
    this.windows.splice(this.windows.indexOf(aWindow), 1);
    for each (let [, tabType] in Iterator(this.tabTypes)) {
      this.unregisterTabTypeFromWindow(aWindow, tabType);
    }
  },

  /**
   * Bind a tab type to a window.
   */
  registerTabTypeWithWindow: function(aWindow, aTabTypeDef) {
    let tabmail = aWindow.document.getElementById("tabmail");

    let tabDefWrapper = new TabDefWrapper(tabmail, aTabTypeDef);
    tabmail.registerTabType(tabDefWrapper);
  },

  /**
   * Unregister a tab definition wrapper from the tabmail it is registered on.
   * We close all outstanding tabs of the type before removing the tab type.
   *
   * In Thunderbird 13.0, tabmail does't have an API to do this, so we need to
   *  reach in and do it.
   */
  unregisterTabTypeFromWindow: function(aWindow, tabDef) {
    let tabmail = aWindow.document.getElementById("tabmail");

    // Close all tabs of the type we are removing
    for each (let [, tab] in Iterator(tabmail.tabInfo.concat())) {
      if (tab.mode.name == tabDef.name)
        tabmail.closeTab(tab);
    }

    // Delete the tab type and mode; they both have the same name.
    delete tabmail.tabTypes[tabDef.name];
    delete tabmail.tabModes[tabDef.name];
  },

  _watcher: null,

  _init: function TbTabs__init() {
    this._watcher = new $winUtils.WindowTracker(this);
    $unload.ensure(this);
  },

  unload: function TbTabs_unload() {
    this._watcher.unload();
    this._watcher = null;
  },
};
TbTabs._init();
