import Component from "@ember/component";
import {
  openLinkInNewTab,
  shouldOpenInNewTab,
} from "discourse/lib/click-track";
import { action } from "@ember/object";
import { openBookmarkModal } from "discourse/controllers/bookmark";
import { ajax } from "discourse/lib/ajax";
import { Promise } from "rsvp";
import { inject as service } from "@ember/service";
import I18n from "I18n";

export default Component.extend({
  tagName: "tr",
  classNames: ["topic-list-item", "bookmark-list-item"],
  dialog: service(),

  click(e) {
    const selected = this.selected,
      bookmark = this.bookmark;

    if (!e.target.classList.contains("bulk-select")) {
      return;
    }

    const lastChecked = document.querySelector("[data-last-checked=true]");

    if (selected.indexOf(bookmark) < 0) {
      this.select(bookmark);

      // allow for shift-click for selection
      if (lastChecked && e.shiftKey) {
        const bulkSelects = Array.from(
            document.querySelectorAll("input.bulk-select")
          ),
          from = bulkSelects.indexOf(e.target),
          to = bulkSelects.findIndex((el) => el.id === lastChecked.id),
          start = Math.min(from, to),
          end = Math.max(from, to);

        bulkSelects
          .slice(start, end)
          .filter((el) => el.checked !== true)
          .forEach((checkbox) => {
            checkbox.click();
          });

        lastChecked.dataset.lastChecked = false;
      }
      e.target.dataset.lastChecked = true;
    } else {
      this.unselect(bookmark);
      if (lastChecked) {
        lastChecked.dataset.lastChecked = false;
      }
    }
  },

  @action
  screenExcerptForExternalLink(event) {
    if (event?.target?.tagName === "A") {
      if (shouldOpenInNewTab(event.target.href)) {
        openLinkInNewTab(event, event.target);
      }
    }
  },

  @action
  removeBookmark(bookmark) {
    return new Promise((resolve, reject) => {
      const deleteBookmark = () => {
        bookmark
          .destroy()
          .then(() => {
            this.appEvents.trigger(
              "bookmarks:changed",
              null,
              bookmark.attachedTo()
            );
            this.remove ? this.remove(bookmark) : null;
            resolve(true);
          })
          .catch((error) => {
            reject(error);
          });
      };
      if (!bookmark.reminder_at) {
        return deleteBookmark();
      }
      this.dialog.deleteConfirm({
        message: I18n.t("bookmarks.confirm_delete"),
        didConfirm: () => deleteBookmark(),
        didCancel: () => resolve(false),
      });
    });
  },

  @action
  editBookmark(bookmark) {
    openBookmarkModal(bookmark, {
      onAfterSave: (savedData) => {
        this.appEvents.trigger(
          "bookmarks:changed",
          savedData,
          bookmark.attachedTo()
        );
        this.reload();
      },
      onAfterDelete: () => {
        this.reload();
      },
    });
  },

  @action
  clearBookmarkReminder(bookmark) {
    return ajax(`/bookmarks/${bookmark.id}`, {
      type: "PUT",
      data: { reminder_at: null },
    }).then(() => {
      bookmark.set("reminder_at", null);
    });
  },

  @action
  togglePinBookmark(bookmark) {
    bookmark.togglePin().then(this.reload);
  },
});
