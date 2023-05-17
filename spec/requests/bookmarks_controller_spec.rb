# frozen_string_literal: true

RSpec.describe BookmarksController do
  let(:current_user) { Fabricate(:user) }
  let(:bookmark_post) { Fabricate(:post) }
  let(:bookmark_topic) { Fabricate(:topic) }
  let(:bookmark_user) { current_user }

  describe "requires login" do
    it "requires login for #bulk" do
      put "/bookmarks/bulk.json"
      expect(response.status).to eq(403)
    end

    it "requires login for #create" do
      post "/bookmarks"
      expect(response.status).to eq(403)
    end

    it "requires login for #destroy" do
      delete "/bookmarks/1.json"
      expect(response.status).to eq(403)
    end

    it "requires login for #bulk" do
      put "/bookmarks/1/toggle_pin.json"
      expect(response.status).to eq(403)
    end
  end

  describe "logged in" do
    before { sign_in(current_user) }

    describe "#create" do
      it "rate limits creates" do
        SiteSetting.max_bookmarks_per_day = 1
        RateLimiter.enable
        RateLimiter.clear_all!

        post "/bookmarks.json",
             params: {
               bookmarkable_id: bookmark_post.id,
               bookmarkable_type: "Post",
               reminder_at: (Time.zone.now + 1.day).iso8601,
             }

        expect(response.status).to eq(200)

        post "/bookmarks.json",
             params: {
               bookmarkable_id: bookmark_post.id,
               bookmarkable_type: "Post",
             }
        expect(response.status).to eq(429)
      end

      context "if the user reached the max bookmark limit" do
        before { SiteSetting.max_bookmarks_per_user = 1 }

        it "returns failed JSON with a 400 error" do
          post "/bookmarks.json",
               params: {
                 bookmarkable_id: bookmark_post.id,
                 bookmarkable_type: "Post",
                 reminder_at: (Time.zone.now + 1.day).iso8601,
               }
          post "/bookmarks.json",
               params: {
                 bookmarkable_id: bookmark_post.id,
                 bookmarkable_type: "Post",
               }

          expect(response.status).to eq(400)
          user_bookmarks_url = "#{Discourse.base_url}/my/activity/bookmarks"
          expect(response.parsed_body["errors"]).to include(
            I18n.t(
              "bookmarks.errors.too_many",
              user_bookmarks_url: user_bookmarks_url,
              limit: SiteSetting.max_bookmarks_per_user,
            ),
          )
        end
      end

      context "if the user already has bookmarked the record" do
        before do
          Fabricate(:bookmark, bookmarkable: bookmark_post, user: bookmark_user)
          Fabricate(:bookmark, bookmarkable: bookmark_topic, user: bookmark_user)
        end

        it "returns failed JSON with a 400 error" do
          post "/bookmarks.json",
               params: {
                 bookmarkable_id: bookmark_post.id,
                 bookmarkable_type: "Post",
                 reminder_at: (Time.zone.now + 1.day).iso8601,
               }

          expect(response.status).to eq(400)
          expect(response.parsed_body["errors"]).to include(
            I18n.t("bookmarks.errors.already_bookmarked", type: "Post"),
          )

          post "/bookmarks.json",
               params: {
                 bookmarkable_id: bookmark_topic.id,
                 bookmarkable_type: "Topic",
                 reminder_at: (Time.zone.now + 1.day).iso8601,
               }

          expect(response.status).to eq(400)
          expect(response.parsed_body["errors"]).to include(
            I18n.t("bookmarks.errors.already_bookmarked", type: "Topic"),
          )
        end
      end
    end

    describe "#destroy" do
      let!(:bookmark) { Fabricate(:bookmark, bookmarkable: bookmark_post, user: bookmark_user) }

      it "destroys the bookmark" do
        delete "/bookmarks/#{bookmark.id}.json"
        expect(Bookmark.find_by(id: bookmark.id)).to eq(nil)
      end

      it "returns an indication of whether there are still bookmarks in the topic" do
        delete "/bookmarks/#{bookmark.id}.json"
        expect(Bookmark.find_by(id: bookmark.id)).to eq(nil)
        expect(response.parsed_body["topic_bookmarked"]).to eq(false)
        bm2 =
          Fabricate(
            :bookmark,
            user: bookmark_user,
            bookmarkable: Fabricate(:post, topic: bookmark_post.topic),
          )
        bm3 = Fabricate(:bookmark, user: bookmark_user, bookmarkable: bookmark_post.topic)
        delete "/bookmarks/#{bm2.id}.json"
        expect(Bookmark.find_by(id: bm2.id)).to eq(nil)
        expect(response.parsed_body["topic_bookmarked"]).to eq(true)
        delete "/bookmarks/#{bm3.id}.json"
        expect(Bookmark.find_by(id: bm3.id)).to eq(nil)
        expect(response.parsed_body["topic_bookmarked"]).to eq(false)
      end

      context "if the bookmark has already been destroyed" do
        it "returns failed JSON with a 403 error" do
          bookmark.destroy!
          delete "/bookmarks/#{bookmark.id}.json"

          expect(response.status).to eq(404)
          expect(response.parsed_body["errors"].first).to include(I18n.t("not_found"))
        end
      end

      context "if the bookmark does not belong to the user" do
        let(:bookmark_user) { Fabricate(:user) }

        it "returns failed JSON with a 403 error" do
          delete "/bookmarks/#{bookmark.id}.json"

          expect(response.status).to eq(403)
          expect(response.parsed_body["errors"].first).to include(I18n.t("invalid_access"))
        end
      end
    end

    describe "#bulk" do
      describe "sanitize input" do
        let(:operation) { { type: "delete" } }
        let(:bookmark_ids) { [1, 2, 3] }

        it "requires a list of bookmark_ids" do
          put "/bookmarks/bulk.json", params: { operation: operation }
          expect(response.status).to eq(400)
        end

        it "requires an operation param" do
          put "/bookmarks/bulk.json", params: { bookmark_ids: bookmark_ids }
          expect(response.status).to eq(400)
        end

        it "requires a type field for the operation param" do
          put "/bookmarks/bulk.json", params: { bookmark_ids: bookmark_ids, operation: {} }
          expect(response.status).to eq(400)
        end
      end

      describe "operations" do
        let!(:bookmark) { Fabricate(:bookmark, user: current_user) }

        it "clears bookmarks reminders" do
          expect {
            put "/bookmarks/bulk.json",
                params: {
                  bookmark_ids: [bookmark.id],
                  operation: {
                    type: "clear_reminder",
                  },
                }
          }.to change { current_user.bookmarks.where.not(reminder_set_at: nil).count }.by(-1)

          expect(response.status).to eq(200)
        end

        it "delete bookmarks reminders" do
          expect {
            put "/bookmarks/bulk.json",
                params: {
                  bookmark_ids: [bookmark.id],
                  operation: {
                    type: "delete_reminder",
                  },
                }
          }.to change { current_user.bookmarks.with_reminders.count }.by(-1)

          expect(response.status).to eq(200)
        end

        it "deletes bookmarks" do
          expect {
            put "/bookmarks/bulk.json",
                params: {
                  bookmark_ids: [bookmark.id],
                  operation: {
                    type: "delete",
                  },
                }
          }.to change { current_user.bookmarks.count }.by(-1)

          expect(response.status).to eq(200)
        end
      end
    end
  end
end
