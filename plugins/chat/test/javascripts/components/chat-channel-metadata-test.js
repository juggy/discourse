import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricators from "../helpers/fabricators";
import { module, test } from "qunit";
import { render } from "@ember/test-helpers";

module("Discourse Chat | Component | chat-channel-metadata", function (hooks) {
  setupRenderingTest(hooks);

  test("displays last message sent at", async function (assert) {
    let lastMessageSentAt = moment().subtract(1, "day").format();
    this.channel = fabricators.directMessageChatChannel({
      last_message_sent_at: lastMessageSentAt,
    });

    await render(hbs`<ChatChannelMetadata @channel={{this.channel}} />`);

    assert.dom(".chat-channel-metadata__date").hasText("Yesterday");

    lastMessageSentAt = moment();
    this.channel.lastMessageSentAt = lastMessageSentAt;
    await render(hbs`<ChatChannelMetadata @channel={{this.channel}} />`);

    assert
      .dom(".chat-channel-metadata__date")
      .hasText(lastMessageSentAt.format("LT"));
  });

  test("unreadIndicator", async function (assert) {
    this.channel = fabricators.directMessageChatChannel();
    this.channel.currentUserMembership.unreadCount = 1;

    this.unreadIndicator = true;
    await render(
      hbs`<ChatChannelMetadata @channel={{this.channel}} @unreadIndicator={{this.unreadIndicator}}/>`
    );

    assert.true(exists(".chat-channel-unread-indicator"));

    this.unreadIndicator = false;
    await render(
      hbs`<ChatChannelMetadata @channel={{this.channel}} @unreadIndicator={{this.unreadIndicator}}/>`
    );

    assert.false(exists(".chat-channel-unread-indicator"));
  });
});
