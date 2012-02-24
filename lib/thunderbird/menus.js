/* ***** BEGIN LICENSE BLOCK *****
* Version: MIT/X11 License
*
* Copyright (c) 2010 Erik Vold
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*
* Contributor(s):
* Erik Vold <erikvvold@gmail.com> (Original Author)
*
* ***** END LICENSE BLOCK ***** */

/*
 * This is a heavily modified version of menuitems.js from
 * https://github.com/erikvold/menuitems-jplib
 *
 * The rationale for including it here is that it's really small/simple, we want
 *  to support Thunderbird (the original was hardcoded for browser.xul), and
 *  we lose the unload+ dependency because it's not required (windowtracker
 *  generates onUntrack notifications on unload).
 *
 * We also alter the API to require developer-friendly aliases for placement.
 */

const windowUtils = require("window-utils");
const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const WINDOW_INFO = {
  "mail:3pane": {
    alias: null,
    windowtype: "mail:3pane",
    menus: {
      // menu bar
      file: {
        id: "menu_FilePopup",
        insertBefore: null,
        contextTransformer: null,
      },
      edit: {
        id: "menu_EditPopup",
        insertBefore: null,
        contextTransformer: null,
      },
      view: {
        id: "menu_View_Popup",
        insertBefore: null,
        contextTransformer: null,
      },
      go: {
        id: "menu_GoPopup",
        insertBefore: null,
        contextTransformer: null,
      },
      message: {
        id: "messageMenuPopup",
        insertBefore: null,
        contextTransformer: null,
      },
      // there are somehow two devToolsSeparators?
      tools: {
        id: "taskPopup",
        insertBefore: "devToolsSeparator",
        contextTransformer: null,
      },

      // message reader
      otherActions: {
        id: "otherActionsPopup",
        insertBefore: null,
        contextTransformer: function(window) {
          return window.gMessageDisplay.displayedMessage;
        },
      },
    },
  },
  "compose": {
    alias: "compose",
    windowtype: "msgcompose",
    menus: {
      // menu bar
      file: {
        id: "menu_FilePopup",
        insertBefore: null,
        contextTransformer: null,
      },
      edit: {
        id: "menu_EditPopup",
        insertBefore: null,
        contextTransformer: null,
      },
      view: {
        id: "menu_View_Popup",
        insertBefore: null,
        contextTransformer: null,
      },
      insert: {
        id: "insertMenuPopup",
        insertBefore: null,
        contextTransformer: null,
      },
      format: {
        id: "formatMenuPopup",
        insertBefore: null,
        contextTransformer: null,
      },
      options: {
        id: "optionsMenuPopup",
        insertBefore: null,
        contextTransformer: null,
      },
      tools: {
        id: "taskPopup",
        insertBefore: null,
        contextTransformer: null,
      },
    }
  }
};

exports.add = function Menuitem(windowAlias, menuAlias, options) {
  if (!WINDOW_INFO.hasOwnProperty(windowAlias))
    throw new Error("No known window type: " + windowAlias);
  let winInfo = WINDOW_INFO[windowAlias];
  if (!winInfo.menus.hasOwnProperty(menuAlias))
    throw new Error("No known menu with name: " + menuAlias);
  let menuInfo = winInfo.menus[menuAlias];

  let contextTransformer;
  new windowUtils.WindowTracker({
    onTrack: function (window) {
      if (window.document.documentElement.getAttribute("windowtype") !==
          winInfo.windowtype)
        return;

      var onCmd = function() {
        if (menuInfo.contextTransformer)
          options.onCommand(menuInfo.contextTransformer(window),
                            window);
        else
          options.onCommand(window);
      };

      // add the new menuitem to a menu
      var menuitem = window.document.createElementNS(NS_XUL, "menuitem");
      menuitem.setAttribute("id", options.id);
      menuitem.setAttribute("label", options.label);
      if (options.accesskey)
        menuitem.setAttribute("accesskey", options.accesskey);
      if (options.key)
        menuitem.setAttribute("key", options.key);
      if (options.image) {
        menuitem.setAttribute("class", "menuitem-iconic");
        menuitem.style.listStyleImage = "url('" + options.image + "')";
      }
      menuitem.addEventListener("command", onCmd, true);

      let parentMenu = window.document.getElementById(menuInfo.id),
          siblingItem = menuitem.insertBefore ?
                          window.document.getElementById(menuInfo.insertBefore) :
                          null;
      parentMenu.insertBefore(menuitem, siblingItem);
    },

    onUntrack: function (window) {
      if (window.document.documentElement.getAttribute("windowtype") !==
          winInfo.windowtype)
        return;

      let menuitem = window.document.getElementById(options.id);
      if (menuitem)
        menuitem.parentNode.removeChild(menuitem);
    }
  });
};
