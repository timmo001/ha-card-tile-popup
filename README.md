# Tile Popup Card

A custom Home Assistant card that displays a tile which shows a popup containing cards.

> [!WARNING]
> This card is experimental, breaking changes may occur. No support will be given

<img width="776" height="1108" alt="image" src="https://github.com/user-attachments/assets/65103d00-4980-4a37-98ff-1a711bc48795" />

## Installation

### HACS (Recommended)

Since this card is not yet in the default HACS store, you need to add it as a custom repository:

1. Open HACS in your Home Assistant instance
2. Click the **3 dots** in the top right corner
3. Select **"Custom repositories"**
4. Add repository URL: `https://github.com/timmo001/ha-card-tile-popup`
5. Select category: **Dashboard**
6. Click **"ADD"**
7. Find "Tile Popup Card" in the list and click **Download**

### Manual

1. Download `tile-popup.js` from the latest release
2. Place it in your `config/www` folder
3. Add the resource in your Lovelace dashboard

## Usage

Add the card to your dashboard using the Lovelace UI editor or YAML:

```yaml
type: custom:tile-popup
label: My popup
icon: mdi:cards
cards:
  - type: markdown
    content: Hello from the popup!
```
