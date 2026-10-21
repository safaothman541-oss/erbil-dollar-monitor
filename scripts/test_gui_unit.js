const guiAgent = require('../modules/guiAgent.js');

const sampleXml = `
<hierarchy rotation="0">
  <node text="" resource-id="" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
    <node text="Search apps" resource-id="com.android.vending:id/search_box" class="android.widget.TextView" bounds="[50,100][900,180]" clickable="true" />
    <node text="Install" resource-id="com.android.vending:id/install_button" class="android.widget.Button" bounds="[700,450][1000,550]" clickable="true" />
    <node text="Telegram" resource-id="com.android.vending:id/app_title" class="android.widget.TextView" bounds="[100,450][650,550]" clickable="true" />
  </node>
</hierarchy>
`;

const els = guiAgent.parseUiElements(sampleXml);
console.log('PARSED ELEMENTS COUNT:', els.length);
console.log(JSON.stringify(els, null, 2));
