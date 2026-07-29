import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileLinkIcon } from "../src/components/ProfileLinkIcon";
import {
  DISCORD_SYMBOL_ICON_SRC,
  DiscordSymbolIcon
} from "../src/shared/DiscordSymbolIcon";

test("Discord 아이콘은 공용 Blurple 이미지 하나를 사용한다", () => {
  const symbolMarkup = renderToStaticMarkup(<DiscordSymbolIcon />);
  const profileMarkup = renderToStaticMarkup(
    <ProfileLinkIcon
      href="https://discord.gg/yoro"
      label="Discord"
      platform="discord"
    />
  );

  assert.equal(
    DISCORD_SYMBOL_ICON_SRC,
    "/images/brand/discord-symbol-blurple.f6c1a66250d3.png"
  );
  assert.match(symbolMarkup, /class="discord-symbol-icon"/u);
  assert.match(symbolMarkup, /aria-hidden="true"/u);
  assert.match(profileMarkup, /discord-symbol-blurple\.f6c1a66250d3\.png/u);
  assert.doesNotMatch(profileMarkup, /<svg/u);
});
