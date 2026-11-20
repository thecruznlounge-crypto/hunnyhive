<?php
header('Content-Type: application/json');
$videoDir=__DIR__.'/videos/';
$videoUrlBase='./library/videos/';
$allowed=['mp4','webm','mov','m4v','ogg'];
$movies=[];
if(is_dir($videoDir)){
  foreach(scandir($videoDir) as $file){
    if($file==='.'||$file==='..') continue;
    $path=$videoDir.$file;
    if(!is_file($path)) continue;
    $ext=strtolower(pathinfo($file,PATHINFO_EXTENSION));
    if(!in_array($ext,$allowed)) continue;
    $name=pathinfo($file,PATHINFO_FILENAME);
    $movies[]=[
      'title'=>ucwords(str_replace(['-','_'],' ',$name)),
      'video'=>$videoUrlBase.rawurlencode($file),
      'recaps'=>[['time'=>'00:00'],['time'=>'18:42'],['time'=>'37:05'],['time'=>'55:30']]
    ];
  }
}
echo json_encode(['movies'=>$movies], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
?>