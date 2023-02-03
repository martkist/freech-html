$(function(){
	$('#showqr').on('click', function(){
		if($('#qrcode img')[0]) return;
         var skey = document.getElementById('skey').innerText;
         new QRCode(document.getElementById("qrcode"), skey);
    });
    $('.tox-ctc').on('click', function(){
    	window.prompt('Press Ctrl/Cmd+C to copy then Enter to close', $(this).attr('data'))
    })
    $('.martkist-ctc').on('click', function(){
    	window.prompt('Press Ctrl/Cmd+C to copy then Enter to close', $(this).attr('data'))
    })
})


	function dhtIndicatorBg(){
		var bgcolor = '';
			  if(freechDhtNodes <= 20){bgcolor = '#770900'
		}else if(freechDhtNodes <= 60){bgcolor = '#773400'
		}else if(freechDhtNodes <= 90){bgcolor = '#774c00'
		}else if(freechDhtNodes <= 120){bgcolor = '#776400'
		}else if(freechDhtNodes <= 150){bgcolor = '#707500'
		}else if(freechDhtNodes <= 180){bgcolor = '#3f6900'
		}else if(freechDhtNodes <= 210){bgcolor = '#005f15'
		}else if(freechDhtNodes >= 250){bgcolor = '#009922'
		}
		$('.userMenu-dhtindicator').animate({'background-color': bgcolor });
	};
	setTimeout(dhtIndicatorBg, 300);
	setTimeout(function() {setInterval(dhtIndicatorBg, 2000)}, 400);
