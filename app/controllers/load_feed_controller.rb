class LoadFeedController < ApplicationController
  
  # POST /load_Feed
  # POST /load_Feed.json
  def index
    feed = Feedzirra::Feed.fetch_and_parse("http://josephsouthern.blogspot.com/feeds/posts/default")
    
    feed.entries.each do |entry|
      @post = Post.find_by_feedID(entry.id)
      
      if @post
        if @post.published != entry.updated
           @post.title = entry.title
           @post.feedID = entry.id
           @post.name = entry.author
           @post.content = entry.content
           @post.published = entry.updated
        end
      else
        @post = Post.new
        @post.title = entry.title
        @post.feedID = entry.id
        @post.name = entry.author
        @post.content = entry.content
        @post.published = entry.updated
      end
      
      @post.save
    end   #each
     redirect_to root_path
  end     #def
end       #class
