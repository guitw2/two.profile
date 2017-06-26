
$(document).ready(function(){
	var source=null;
	var file_array=null;
	var impulse_array=null;
	var visual_type='t';
	var modal = document.getElementById('myModal');
	var decodingModal = document.getElementById('decodingModal');
	var loaded=false;
	var impulse_loaded=false;
	var audioCtx = new(AudioContext || webkitAudioContext);
	var inputStreamSource = null;
	var source = audioCtx.createBufferSource();
	var convolver = audioCtx.createConvolver();
	var processorBufferSize=4096;//16384
	var scriptNode = audioCtx.createScriptProcessor(processorBufferSize);
	var scriptCustomNode = audioCtx.createScriptProcessor(processorBufferSize);
	var backbufferSize=2;
	var bufferSecundario = [new Float32Array(processorBufferSize*backbufferSize),new Float32Array(processorBufferSize*backbufferSize)]; //stereo
	var inputData = new Float32Array(processorBufferSize);
	var audioBuffer= null;
	var masterGain = audioCtx.createGain();
	var analyser = audioCtx.createAnalyser();
	analyser.fftSize = 1024;
	var bufferLength = analyser.frequencyBinCount;
	var dataArray = new Uint8Array(bufferLength);
	var textCoeficients = document.getElementById("textCoeficients");
	analyser.getByteTimeDomainData(dataArray);
	masterGain.gain.value=0.3;
	var dest = audioCtx.createMediaStreamDestination();

	var activeDSP = scriptNode;

	var configs={
		workerDir: "lib/web-audio-recorder-js/",
		numChannels: 2
	}	
	var recorder = new WebAudioRecorder(masterGain, configs);

	var timeOut = 0;

	var canvasWave = document.getElementById("oscilloscope");
	var canvasImpulse = document.getElementById("graphImpulse");
	var container1 = document.getElementById("container1");
	var container2 = document.getElementById("container2");
	var container3 = document.getElementById("container3");
	var container4 = document.getElementById("container4");
	var canvasCtxWave = canvasWave.getContext("2d");
	var canvasCtxImpulse = canvasImpulse.getContext("2d");
	
	var processingTime = null;

	var sourceOption = null;

	var playing = false;
	
	function resize_canvas(){
		canvasWave.width = Math.round(container1.clientWidth*.97);
		canvasWave.height = 100;
		canvasImpulse.width = Math.round(container2.clientWidth*.95);
		canvasImpulse.height = 100;	
		drawWave();
		drawCoeficients();		
	}
	
	 $(window).on('resize', function() {
		resize_canvas();
	});
	
	function drawWave() {			
		drawVisual = requestAnimationFrame(drawWave);
		canvasCtxWave.lineWidth = 1;
		canvasCtxWave.fillStyle = '#424242';
		canvasCtxWave.fillRect(0, 0, canvasWave.width, canvasWave.height);	
		if(visual_type=='t'){
			analyser.getByteTimeDomainData(dataArray);							
			canvasCtxWave.strokeStyle = '#aaa';
			canvasCtxWave.beginPath();
			var sliceWidth = canvasWave.width * 1.0 / bufferLength;
			var x = 0;
			for (var i = 0; i < bufferLength; i++) {
				var v = dataArray[i] / 128.0;
				var y = v * canvasWave.height / 2;
				if (i === 0) {
					canvasCtxWave.moveTo(x, y);
				} else {
					canvasCtxWave.lineTo(x, y);
				}
				x += sliceWidth;
			}
			canvasCtxWave.stroke();
		}
		else{
			analyser.getByteFrequencyData(dataArray);							
			canvasCtxWave.strokeStyle = '#aaa';
			canvasCtxWave.beginPath();
			var sliceWidth = canvasWave.width * 1.0 / bufferLength;
			var x = 0;
			for(var i = 0; i < bufferLength; i++) {
   				var v = dataArray[i] / 128.0;
				var y = canvasWave.height - v * canvasWave.height/2 -1;
				if(i === 0) {
					canvasCtxWave.moveTo(x, y);
				} else {
					canvasCtxWave.lineTo(x, y);
				}
				x += sliceWidth;
			}
			canvasCtxWave.stroke();
		}			
	};

	function drawCoeficients(){	
		var impulseMax=getMaxOfArray(coeficients);
		var impulseMin=getMinOfArray(coeficients);
		var impulseYMax=Math.max(impulseMax,Math.abs(impulseMin));
		canvasCtxImpulse.fillStyle = '#424242';
		canvasCtxImpulse.fillRect(0, 0, canvasImpulse.width, canvasImpulse.height);
		canvasCtxImpulse.lineWidth = 1;
		canvasCtxImpulse.strokeStyle = '#222';
		canvasCtxImpulse.beginPath();
		canvasCtxImpulse.moveTo(0, canvasImpulse.height/2+1);
		canvasCtxImpulse.lineTo(canvasImpulse.width, canvasImpulse.height/2+1);
		canvasCtxImpulse.stroke();
		canvasCtxImpulse.strokeStyle = '#aaa';
		canvasCtxImpulse.beginPath();
		var sliceWidth = canvasImpulse.width * 1.0 / coeficientsLength;			
		var x = 0;
		for (var i = 0; i < coeficientsLength; i++) {
			var y = canvasImpulse.height - Math.abs(coeficients[i]/impulseYMax+1)*canvasImpulse.height/2.1;
			if (i === 0) {
				canvasCtxImpulse.moveTo(x, y);
			} else {
				canvasCtxImpulse.lineTo(x, y);
			}
			x += sliceWidth;
		}
		canvasCtxImpulse.stroke();
	}

	var canvasProc = document.getElementById("timeInfo");
	var canvasCtxProc = canvasProc.getContext("2d");
	var fps = 5;
	var now;
	var then = Date.now();
	var interval = 1000/fps;
	var delta;
	var procTimeArraySize = 20;
	var procTimeArray = new Array(procTimeArraySize);

	function drawProcTime() {		
		requestAnimationFrame(drawProcTime);			
		var sliceWidth = canvasProc.width * 1.0 / procTimeArraySize;
		now = Date.now();
    	delta = now - then;     
    	if (delta > interval){
    		if(!playing){timeOut=0;}
    		then = now - (delta % interval);
			canvasCtxProc.lineWidth = 1;
			canvasCtxProc.fillStyle = '#232323';
			canvasCtxProc.fillRect(0, 0, canvasProc.width, canvasProc.height);	
			canvasCtxProc.fillStyle = "#aaa";	
			canvasCtxProc.font = "14px Arial";
			canvasCtxProc.fillText(timeOut+"ms",canvasProc.width-35,15);				
			canvasCtxProc.strokeStyle = '#709070';
			canvasCtxProc.beginPath();
			procTimeArray[procTimeArraySize-1]=timeOut*.75;
			
			var x = 1;
			for (var i = 0; i < procTimeArraySize; i++) {
				var y = canvasProc.height - procTimeArray[i]/3;
				if (i === 0) {
					canvasCtxProc.moveTo(x, y);
				} else {
					canvasCtxProc.lineTo(x, y);
				}
				x += sliceWidth;
			}
			for (var i = 0; i < procTimeArraySize-1; i++) {
				procTimeArray[i]=procTimeArray[i+1];
			}
			canvasCtxProc.stroke();	
    	} 					
	};

	drawProcTime();		
	resize_canvas();
	drawWave();		
	
	scriptNode.onaudioprocess = function(audioProcessingEvent) {	
		var inputBuffer = audioProcessingEvent.inputBuffer;
		var outputBuffer = audioProcessingEvent.outputBuffer;
		var dIn = new Date();
		var timeIn = dIn.getTime();			
		for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
			var inputData = inputBuffer.getChannelData(channel);
			var outputData = outputBuffer.getChannelData(channel);
			for (var sample = 0; sample < processorBufferSize; sample++){
				processando=0;
				for(var index=0; index < coeficients.length; index++){
					if(sample+index<coeficients.length){
						processando += bufferSecundario[channel][(sample+index)+(processorBufferSize-coeficients.length)]*coeficients[index];	
					}
					else{
						processando += inputData[(sample+index)-coeficients.length]*coeficients[index];				
					}
				}
				outputData[sample]=processando;		
			}
			bufferSecundario[channel]=inputData;
		}	
		var dOut = new Date();
		timeOut=dOut.getTime() - timeIn;
		//console.log(timeOut);		
	}	

	scriptCustomNode.onaudioprocess = function(audioProcessingEvent) {
		var dIn = new Date();
		var timeIn = dIn.getTime();	
		var inputBuffer = audioProcessingEvent.inputBuffer;
		var outputBuffer = audioProcessingEvent.outputBuffer;
		for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
			var inputData = inputBuffer.getChannelData(channel);
			var outputData = outputBuffer.getChannelData(channel);
			for (var sample = 0; sample < inputBuffer.length; sample++){
				outputData[sample]=inputData[sample];	
			}
		}
		var dOut = new Date();
		timeOut=dOut.getTime() - timeIn;
	}

	$("#customEditor").html("//este exemplo básico passa a entrada direto para a saída\nvar inputBuffer = audioProcessingEvent.inputBuffer;\nvar outputBuffer = audioProcessingEvent.outputBuffer;\nfor (var channel = 0; channel < outputBuffer.numberOfChannels; channel++)\n{\n\tvar inputData = inputBuffer.getChannelData(channel);\n\tvar outputData = outputBuffer.getChannelData(channel);\n\tfor (var sample = 0; sample < inputBuffer.length; sample++)\n\t{\n\t\toutputData[sample]=inputData[sample];\n\t}\n}");
	
	var coeficients = new Float32Array([-4.61221813409777e-07,-3.64700036646293e-07,-5.86018381358106e-07,-8.83837671258784e-07,-1.27144219510340e-06,-1.76207594777872e-06,-2.36838674226705e-06,-3.10176667051084e-06,-3.97159119894647e-06,-4.98436287284348e-06,-6.14276967159529e-06,-7.44467243345447e-06,-8.88204036355284e-06,-1.04398583466168e-05,-1.20950344825225e-05,-1.38153408111398e-05,-1.55584244430049e-05,-1.72709301051700e-05,-1.88877782822445e-05,-2.03316455144564e-05,-2.15126948434034e-05,-2.23286047152337e-05,-2.26649437158585e-05,-2.23959361965040e-05,-2.13856600461725e-05,-1.94897125038024e-05,-1.65573729329209e-05,-1.24342828979679e-05,-6.96565371732195e-06,2.90510579063578e-20,8.60661537667441e-06,1.89858536532914e-05,3.12519340018792e-05,4.54960888232423e-05,6.17807170069518e-05,8.01333281392789e-05,0.000100540386855004,0.000122941182035277,0.000147221859925730,0.000173209773044306,0.000200668307521005,0.000229292359823256,0.000258704639250128,0.000288452974734682,0.000318008803025633,0.000346767009928412,0.000374047286735914,0.000399097150107954,0.000421096755385477,0.000439165610660744,0.000452371271974843,0.000459740068986824,0.000460269875666469,0.000452944902421480,0.000436752445098166,0.000410701483109365,0.000373842974252016,0.000325291648369356,0.000264249056748890,0.000190027589943309,0.000102075134513563,-2.72490215764211e-19,-0.000116404287789644,-0.000247134761363565,-0.000391955812600425,-0.000550377496556929,-0.000721635824479785,-0.000904675534450830,-0.00109813582132228,-0.00130033949166174,-0.00150928598406428,-0.00172264866031244,-0.00193777672856664,-0.00215170210632835,-0.00236115146880895,-0.00256256365822339,-0.00275211255226110,-0.00292573540659972,-0.00307916659801957,-0.00320797660279821,-0.00330761595109749,-0.00337346380358864,-0.00340088070326541,-0.00338526496499103,-0.00332211207955560,-0.00320707642961284,-0.00303603454350207,-0.00280514905124045,-0.00251093245637810,-0.00215030979927871,-0.00172067926287830,-0.00121996976203360,-0.000646694562916047,8.52635256252286e-19,0.000720291604772966,0.00151364566318813,0.00237878645649018,0.00331367637667902,0.00431550386739363,0.00538068054879504,0.00650484789012477,0.00768289366348807,0.00890897827483502,0.0101765709252102,0.0114784954093798,0.0128069852123024,0.0141537474190173,0.0155100348128573,0.0168667254028646,0.0182144084962895,0.0195434763183103,0.0208442200807393,0.0221069293163548,0.0233219932272867,0.0244800027459678,0.0255718519766262,0.0265888376749057,0.0275227554333770,0.0283659912715117,0.0291116073798512,0.0297534208389613,0.0302860742233365,0.0307050971073831,0.0310069576133335,0.0311891032775162,0.0312499906596634,0.0311891032775162,0.0310069576133335,0.0307050971073831,0.0302860742233365,0.0297534208389613,0.0291116073798512,0.0283659912715117,0.0275227554333770,0.0265888376749057,0.0255718519766262,0.0244800027459678,0.0233219932272867,0.0221069293163548,0.0208442200807393,0.0195434763183103,0.0182144084962895,0.0168667254028646,0.0155100348128573,0.0141537474190173,0.0128069852123024,0.0114784954093798,0.0101765709252102,0.00890897827483502,0.00768289366348807,0.00650484789012477,0.00538068054879504,0.00431550386739363,0.00331367637667902,0.00237878645649018,0.00151364566318813,0.000720291604772966,8.52635256252286e-19,-0.000646694562916047,-0.00121996976203360,-0.00172067926287830,-0.00215030979927871,-0.00251093245637810,-0.00280514905124045,-0.00303603454350207,-0.00320707642961284,-0.00332211207955560,-0.00338526496499103,-0.00340088070326541,-0.00337346380358864,-0.00330761595109749,-0.00320797660279821,-0.00307916659801957,-0.00292573540659972,-0.00275211255226110,-0.00256256365822339,-0.00236115146880895,-0.00215170210632835,-0.00193777672856664,-0.00172264866031244,-0.00150928598406428,-0.00130033949166174,-0.00109813582132228,-0.000904675534450830,-0.000721635824479785,-0.000550377496556929,-0.000391955812600425,-0.000247134761363565,-0.000116404287789644,-2.72490215764211e-19,0.000102075134513563,0.000190027589943309,0.000264249056748890,0.000325291648369356,0.000373842974252016,0.000410701483109365,0.000436752445098166,0.000452944902421480,0.000460269875666469,0.000459740068986824,0.000452371271974843,0.000439165610660744,0.000421096755385477,0.000399097150107954,0.000374047286735914,0.000346767009928412,0.000318008803025633,0.000288452974734682,0.000258704639250128,0.000229292359823256,0.000200668307521005,0.000173209773044306,0.000147221859925730,0.000122941182035277,0.000100540386855004,8.01333281392789e-05,6.17807170069518e-05,4.54960888232423e-05,3.12519340018792e-05,1.89858536532914e-05,8.60661537667441e-06,2.90510579063578e-20,-6.96565371732195e-06,-1.24342828979679e-05,-1.65573729329209e-05,-1.94897125038024e-05,-2.13856600461725e-05,-2.23959361965040e-05,-2.26649437158585e-05,-2.23286047152337e-05,-2.15126948434034e-05,-2.03316455144564e-05,-1.88877782822445e-05,-1.72709301051700e-05,-1.55584244430049e-05,-1.38153408111398e-05,-1.20950344825225e-05,-1.04398583466168e-05,-8.88204036355284e-06,-7.44467243345447e-06,-6.14276967159529e-06,-4.98436287284348e-06,-3.97159119894647e-06,-3.10176667051084e-06,-2.36838674226705e-06,-1.76207594777872e-06,-1.27144219510340e-06,-8.83837671258784e-07,-5.86018381358106e-07,-3.64700036646293e-07,-4.61221813409777e-07]);
	
	textCoeficients.value = coeficients;
	var coeficientsLength = coeficients.length;
	getCoeficients();		
	
	$("#load_file").click(
		function(){
			var files = document.getElementById('audio_file').files;
			if (!files.length) {
			  alert('Selecione um arquivo de áudio primeiro');
			  return;
			}						
			modal.style.display = "block";
			var file = files[0];
			var reader = new FileReader();
			reader.readAsArrayBuffer(file);
			reader.onloadend = function(event) {
				loaded=true;
				sourceOption="file";
				if(!playing){
					$("#play").removeAttr("disabled");
					disconnectAll();
				}
				$("#stop").removeAttr("disabled");
				modal.style.display = "none";
				decodingModal.style.display = "block";
				file_array=event.target.result;
				source = audioCtx.createBufferSource();
				audioCtx.decodeAudioData(file_array).then(function(buffer2) {	
					audioBuffer = buffer2;
					decodingModal.style.display = "none";				
				});
			}
		}
	);
	
	$("#load_input").click(
		function(){
			if (navigator.webkitGetUserMedia !== undefined) {
			    constraint = {
			        video: false,
			        audio: {
			            optional: [
			                {googAutoGainControl: false},
			                {googAutoGainControl2: false},
			                {echoCancellation: false},
			                {googEchoCancellation: false},
			                {googEchoCancellation2: false},
			                {googDAEchoCancellation: false},
			                {googNoiseSuppression: false},
			                {googNoiseSuppression2: false},
			                {googHighpassFilter: false},
			                {googTypingNoiseDetection: false},
			                {googAudioMirroring: false}
			            ]
			        }
			    }
			}
			else if (navigator.mozGetUserMedia !== undefined) {
			    constraint = {
			        video: false,
			        audio: {
			            echoCancellation: false,
			            mozAutoGainControl: false
			            //mozNoiseSuppression: false
			        }
			    }

			}
			else {
			    constraint = {
			        video: false,
			        audio: {
			            echoCancellation: false
			        }
			    }
			}
			navigator.mediaDevices.getUserMedia(constraint).then(function(stream) {
					sourceOption = "input";
					inputStreamSource = audioCtx.createMediaStreamSource(stream);
					if(!playing){
						$("#play").removeAttr("disabled");
						disconnectAll();
					}						
				}).catch(function(err) {
					window.alert("Ocorreu um erro ao obter a entrada de áudio: " + err);
			});
		}
	);
	
	$("#play").click(
		function(){
			switch(sourceOption){
				case "file":
					if (!loaded) {
						  alert('Selecione um arquivo de áudio e clique em carregar primeiro');
						  return;
					}
					else{
						playing = true;
						$("#play").attr("disabled","disabled");
						$("#record").removeAttr("disabled");
						$("#stop").removeAttr("disabled");
						source = audioCtx.createBufferSource();
						source.buffer=audioBuffer;
						reconectNodes();
						source.start();
					}
					break;
				case "input":
					playing=true;
					$("#play").attr("disabled","disabled");
					$("#record").removeAttr("disabled");
					$("#stop").removeAttr("disabled");
					source=inputStreamSource;
					if($("#power").prop("checked")){
						source.connect(scriptNode);	
						scriptNode.connect(analyser);
						analyser.connect(masterGain);
						masterGain.connect(audioCtx.destination);
					}
					else{
						source.connect(analyser);					
						analyser.connect(masterGain);
						masterGain.connect(audioCtx.destination);			
					}
					break;
			}
		}
	);			
	
	$("#stop").click(
		function(){
			disconnectAll();
			$("#play").removeAttr("disabled");
			$("#stop").attr("disabled","disabled");
			if(!recorder.isRecording()){
				$("#record").attr("disabled","disabled");
			}
			playing=false;
		}
	);
	$("#oscilloscope").click(function(){
		if(visual_type=='t'){visual_type='f';}
		else{visual_type='t';}			
	});

	$("#record").click(
		function(){
			if(recorder.isRecording()){
				$("#record").html("Record");
				$("#cancel_recording").attr("disabled","disabled");
				recorder.onComplete = function(recorder, blob) {
					var download = document.createElement("a");
					document.body.appendChild(download);
					download.style = "display: none";
				    url = window.URL.createObjectURL(blob);
				    download.href = url;
				    download.download = name;
				    download.click();
				    window.URL.revokeObjectURL(url);
				}
				recorder.finishRecording();
				if(!playing){
					$("#record").attr("disabled","disabled");
				}
			}
			else{
				$("#cancel_recording").removeAttr("disabled");
				$("#record").html("Save");
				var configs={
					workerDir: "lib/web-audio-recorder-js/",
					numChannels: 2
				}	

				recorder = new WebAudioRecorder(masterGain, configs);
				recorder.startRecording();
			}
		}
	);

	$("#cancel_recording").click(
		function(){
			recorder.cancelRecording();
			$("#cancel_recording").attr("disabled","disabled");
			$("#record").html("Record");
			if(!playing){
				$("#record").attr("disabled","disabled");
			}
		}
	);
	
	function getMaxOfArray(numArray) {
		return Math.max.apply(null, numArray);
	}	
	function getMinOfArray(numArray) {
		return Math.min.apply(null, numArray);
	}	
	
	function getCoeficients(){
		var rawCoeficients=textCoeficients.value.split(",");
		var dataCoeficients = rawCoeficients;
		var coeficientsLength = rawCoeficients.length;
		for(var i=0;i<coeficientsLength;i++){
			dataCoeficients[i]=parseFloat(rawCoeficients[i]);			
		}
		coeficients=dataCoeficients;
		drawCoeficients();
	}
	
	$("#getCoeficients").click(function(){
		getCoeficients();			
	});
	
	function disconnectAll()
	{
		source.disconnect();
		activeDSP.disconnect();
		analyser.disconnect();
		masterGain.disconnect();
	}
	
	$("#vol-control").change(function(){
		masterGain.gain.value=$(this).val();
		$("#volume_text").text("Volume: "+parseInt($(this).val()*100)+"%");
	});
	
	function reconectNodes(){
		if(playing){
			if($("#power").prop("checked")){
				disconnectAll();
				source.connect(activeDSP);	
				activeDSP.connect(analyser);
				analyser.connect(masterGain);
				masterGain.connect(audioCtx.destination);
			}
			else{
				disconnectAll();
				source.connect(analyser);					
				analyser.connect(masterGain);
				masterGain.connect(audioCtx.destination);	
				timeOut=0;		
			}
		}

	}

	$("#power").change(function(){
		reconectNodes();
	});

	$("#selectFilter").change(function(){
		var selected = $(this).val();
		switch(selected) {
		    case "selectFIR":
		    	disconnectAll();
		        activeDSP=scriptNode;
		        reconectNodes();
		        $("#firCoef").show(500);
				$("#customFilter").hide(500);
		        break;
		    case "selectCustom":
		    	disconnectAll();
		        activeDSP=scriptCustomNode;
		        reconectNodes();
		        $("#customFilter").show(500);
				$("#firCoef").hide(500);
		        break;
		    default:
		        break;
		}
	});

	$("#customFilter").hide();

	$("#customGET").click(function(){
		var customCode = $("#customEditor").val();
		var customFunction="scriptCustomNode.onaudioprocess = function(audioProcessingEvent) {var dIn = new Date();var timeIn = dIn.getTime();"+customCode+"var dOut = new Date();timeOut=dOut.getTime() - timeIn;}";
		eval(customFunction);
	});

	function showFilter(selected){
		switch(selected){
			case "selectFIR":

		    case "selectCustom":

		    default:
		        break;
		}

	}
	
	$("#menuPlayer").click(function(){
		$("#container1").show();
		$("#container2").hide();
		$("#container3").hide();
		$("#container4").hide();
		$("#menuPlayer").addClass("menuSelected");
		$("#menuFilter").removeClass("menuSelected");
		$("#menuConfig").removeClass("menuSelected");
		$("#menuAbout").removeClass("menuSelected");
		resize_canvas();
	});
	$("#menuFilter").click(function(){
		$("#container1").hide();
		$("#container2").show();
		$("#container3").hide();
		$("#container4").hide();
		$("#menuPlayer").removeClass("menuSelected");
		$("#menuFilter").addClass("menuSelected");
		$("#menuConfig").removeClass("menuSelected");
		$("#menuAbout").removeClass("menuSelected");
		resize_canvas();
	});
	$("#menuConfig").click(function(){
		$("#container1").hide();
		$("#container2").hide();
		$("#container3").show();
		$("#container4").hide();
		$("#menuPlayer").removeClass("menuSelected");
		$("#menuFilter").removeClass("menuSelected");
		$("#menuConfig").addClass("menuSelected");
		$("#menuAbout").removeClass("menuSelected");
	});
	$("#menuAbout").click(function(){
		$("#container1").hide();
		$("#container2").hide();
		$("#container3").hide();
		$("#container4").show();
		$("#menuPlayer").removeClass("menuSelected");
		$("#menuFilter").removeClass("menuSelected");
		$("#menuConfig").removeClass("menuSelected");
		$("#menuAbout").addClass("menuSelected");
	});
});