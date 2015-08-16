from lightning import Lightning
from numpy import random, ceil, array

lgn = Lightning()

x = random.randn(100) * 15
y = random.randn(100) * 15
group = ceil(random.rand(100) * 5)
size = random.rand(100) * 20 + 5

lgn.scatter(x, y, group=group, size=size, alpha=alpha)