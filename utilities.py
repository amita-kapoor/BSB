import matplotlib.pyplot as plt
import numpy as np
from ipywidgets import FloatSlider
from IPython.display import display

def plot_line(m, c):
    plt.figure(figsize=(8, 6))
    x = np.linspace(-10, 10, 400)
    y = m * x + c

    plt.plot(x, y, color='blue')
    plt.xlim(-10, 10)
    plt.ylim(-10, 10)
    plt.grid(True)
    plt.axhline(0, color='black', linewidth=0.5)
    plt.axvline(0, color='black', linewidth=0.5)
    plt.title(f"Graph of y = {m}x + {c}")
    plt.xlabel('x')
    plt.ylabel('y')
    plt.show()

m_slider = FloatSlider(min=-10, max=10, step=0.5, value=1, description='m (Slope):')
c_slider = FloatSlider(min=-10, max=10, step=1, value=0, description='c (Intercept):')