How CSS files get loaded by joe

>To start we need to reference appliction.css.scss
	In /views/layouts/applicaton.html.erb add
		<%= stylesheet_link_tag "application"%>

>After we reference application.css.scss we need to load the css that is used every time.
	In /stylesheets/application.css.scss
		REMOVE: Require tree . 
		BECAUSE: it will load every css file 
	Now add css files in order you want them loaded.
		@import "_01_reset.css.scss";
		@import "_02_960_16_col.css.scss";
		@import "_header.css.scss";
		@import "site.css.scss";
		
>Now we want the controller css to load when that controller is used.
	Back in /views/layout/application.html.erb add
		   <%= stylesheet_link_tag params[:controller] %>
	This will load the stylesheet based on the controller name.
	
>The mobile css just overrides values in site.css.scss 
	In /views/layouts/applicaton.html.erb add
		<%= stylesheet_link_tag "mobile" if mobile_device? %>
	after the application's stylesheets are loaded.
	> In the application_controller.rb add
		private
	  	def mobile_device?
	    	request.user_agent =~ /Mobile|webOS/
	  	end
	  	helper_method :mobile_device?
	
