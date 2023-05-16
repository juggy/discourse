import Component from "@ember/component";
import { action } from "@ember/object";
import { next, schedule } from "@ember/runloop";
import Scrolling from "discourse/mixins/scrolling";
import BulkTopicSelection from "discourse/mixins/bulk-topic-selection";
import showModal from "discourse/lib/show-modal";

export default Component.extend(Scrolling, BulkTopicSelection, {
  classNames: ["bookmark-list-wrapper"],

  didInsertElement() {
    this._super(...arguments);
    this.bindScrolling();
    this.scrollToLastPosition();
  },

  willDestroyElement() {
    this._super(...arguments);
    this.unbindScrolling();
  },

  scrollToLastPosition() {
    const scrollTo = this.session.bookmarkListScrollPosition;
    if (scrollTo >= 0) {
      schedule("afterRender", () => {
        if (this.element && !this.isDestroying && !this.isDestroyed) {
          next(() => window.scrollTo(0, scrollTo));
        }
      });
    }
  },

  scrolled() {
    this._super(...arguments);
    this.session.set("bookmarkListScrollPosition", window.scrollY);
  },

  @action
  bulkSelectAll() {
    this.send("updateAutoAddTopicsToBulkSelect", true);
    document
      .querySelectorAll("input.bulk-select:not(:checked)")
      .forEach((el) => el.click());
  },

  @action
  bulkClearAll() {
    this.send("updateAutoAddTopicsToBulkSelect", false);
    document
      .querySelectorAll("input.bulk-select:checked")
      .forEach((el) => el.click());
  },

  @action
  selectBookmark(bookmark) {
    this.selected.addObject(bookmark);
  },

  @action
  unselectBookmark(bookmark) {
    this.selected.removeObject(bookmark);
  },

  @action
  showBulkActions() {
    const controller = showModal("bookmark-bulk-actions", {
      model: {
        topics: this.selected
      },
      title: "topics.bulk.actions",
    });

    controller.set("refreshClosure", () => this.send("refresh"));
  }
});
