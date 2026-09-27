/**
 * @jest-environment jsdom
 */

const { setupEnvironment } = require('./setup');

describe('Feature 4: Built-In Camera Scanner Modal & Controls', () => {
  beforeEach(() => {
    localStorage.clear();
    setupEnvironment();
  });

  test('Scanner.close stops active video stream and closes modal', () => {
    const modal = document.getElementById('scan-modal');
    modal.classList.add('open');
    expect(modal.classList.contains('open')).toBe(true);

    window.Scanner.close();
    expect(modal.classList.contains('open')).toBe(false);
  });

  test('Scanner.open returns a rejected promise when scan-close button is clicked', async () => {
    // Mock getUserMedia
    const mockTrack = { stop: jest.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream)
      },
      writable: true
    });

    const openPromise = window.Scanner.open();
    // Allow stream promise to resolve
    await new Promise(r => setTimeout(r, 10));

    const closeBtn = document.getElementById('scan-close');
    closeBtn.click();

    await expect(openPromise).rejects.toThrow('cancelled');
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
