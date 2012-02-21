$(document).ready(function(){
	$("div.header_line").hoverIntent({
		over: showHeaderMenu, 
		timeout: 500, 
		out: hideHeaderMenu
	});
}); // close document.ready

function showHeaderMenu(){  
							var menu = $(".header_menu_move");
							menu.animate({"margin-top": "+=2em"}, 
										  "slow",
										   function(){
												    menu.css("z-index", "100");	
											}
					                    );
};
function hideHeaderMenu(){  
	 					var menu = $(".header_menu_move");
						menu.css("z-index", -1);
						menu.animate({"margin-top": "-2em"}, "slow");
					};
					
